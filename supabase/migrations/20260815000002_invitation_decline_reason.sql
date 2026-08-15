-- Decline reason capture, 4-param respond_to_plan_invitation, idempotent accept.

ALTER TABLE public.plan_invitations
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS decline_reason_other TEXT;

COMMENT ON COLUMN public.plan_invitations.decline_reason IS 'Quick-pick reason when invitee declines.';
COMMENT ON COLUMN public.plan_invitations.decline_reason_other IS 'Free text when decline_reason is Other.';

DROP FUNCTION IF EXISTS public.respond_to_plan_invitation(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.respond_to_plan_invitation(
  p_invitation_id UUID,
  p_action TEXT,
  p_decline_reason TEXT DEFAULT NULL,
  p_decline_reason_other TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitee_id UUID := auth.uid();
  _invitation public.plan_invitations%ROWTYPE;
  _plan public.plans%ROWTYPE;
  _host_name TEXT;
  _invitee_name TEXT;
  _slot_amount BIGINT;
  _escrow_id UUID;
  _offer_id UUID;
  _is_kyc_verified BOOLEAN;
  _is_group_split BOOLEAN;
  _idx INT;
  _total BIGINT;
  _host_share BIGINT;
  _guest_share BIGINT;
  _payer_id UUID;
  _payee_id UUID;
BEGIN
  IF _invitee_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _invitation FROM public.plan_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = _invitation.plan_id FOR UPDATE;

  IF _invitation.invitee_user_id IS DISTINCT FROM _invitee_id THEN
    RAISE EXCEPTION 'not_invitee';
  END IF;

  IF _plan.status = 'cancelled' THEN
    RAISE EXCEPTION 'plan_not_available';
  END IF;

  IF _invitation.status = 'accepted'
     AND _invitation.invitee_user_id = _invitee_id
     AND p_action = 'accept' THEN
    SELECT id INTO _offer_id
    FROM public.plan_offers
    WHERE plan_id = _invitation.plan_id AND bidder_id = _invitee_id
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT id INTO _escrow_id
    FROM public.escrow_transactions
    WHERE plan_id = _invitation.plan_id AND guest_id = _invitee_id
    ORDER BY created_at DESC
    LIMIT 1;

    _slot_amount := public.resolve_join_request_slot_cents(_plan);

    RETURN jsonb_build_object(
      'action', 'accepted',
      'isNegotiable', COALESCE(_plan.is_negotiable, true),
      'offerId', _offer_id,
      'escrowId', _escrow_id,
      'slotAmountCents', _slot_amount
    );
  END IF;

  IF _invitation.status != 'pending' THEN
    RAISE EXCEPTION 'invitation_not_pending';
  END IF;

  IF _invitation.expires_at < NOW() THEN
    UPDATE public.plan_invitations
    SET status = 'expired', slot_held = FALSE, responded_at = NOW()
    WHERE id = p_invitation_id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  IF p_action = 'accept' THEN
    SELECT (verification_status = 'verified') INTO _is_kyc_verified
    FROM public.users WHERE id = _invitee_id;

    IF NOT COALESCE(_is_kyc_verified, false) THEN
      RAISE EXCEPTION 'kyc_required';
    END IF;

    IF NOT COALESCE(_invitation.slot_held, false)
       AND public.get_plan_available_slots(_invitation.plan_id) <= 0 THEN
      RAISE EXCEPTION 'no_slots_available';
    END IF;
  END IF;

  SELECT display_name INTO _host_name FROM public.profiles WHERE user_id = _invitation.host_id;
  SELECT display_name INTO _invitee_name FROM public.profiles WHERE user_id = _invitee_id;

  IF p_action = 'accept' THEN
    UPDATE public.plan_invitations
    SET status = 'accepted', slot_held = FALSE, responded_at = NOW()
    WHERE id = p_invitation_id;

    IF COALESCE(_plan.is_negotiable, true) THEN
      _slot_amount := public.resolve_join_request_slot_cents(_plan);
      IF _slot_amount <= 0 THEN
        RAISE EXCEPTION 'invalid_slot_amount';
      END IF;

      INSERT INTO public.plan_offers (
        plan_id,
        bidder_id,
        amount_cents,
        current_amount_cents,
        status,
        last_action_by,
        awaiting_response_from,
        round,
        expires_at
      ) VALUES (
        _invitation.plan_id,
        _invitee_id,
        _slot_amount::INTEGER,
        _slot_amount::INTEGER,
        'pending',
        'guest',
        'host',
        COALESCE((SELECT MAX(round) + 1 FROM public.plan_offers WHERE plan_id = _invitation.plan_id), 1),
        NOW() + INTERVAL '24 hours'
      )
      RETURNING id INTO _offer_id;

      PERFORM public._record_offer_round(
        _offer_id,
        _invitation.plan_id,
        _invitee_id,
        'guest',
        'offer',
        _slot_amount::INTEGER,
        NULL
      );
    ELSE
      _slot_amount := public.resolve_join_request_slot_cents(_plan);
      IF _slot_amount <= 0 THEN
        RAISE EXCEPTION 'invalid_slot_amount';
      END IF;

      _is_group_split := public.is_group_split_dynamic_plan(_plan);

      IF _is_group_split THEN
        SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO _idx
        FROM public.escrow_transactions WHERE plan_id = _plan.id;

        INSERT INTO public.escrow_transactions (
          plan_id,
          payer_id,
          payee_id,
          host_id,
          guest_id,
          group_plan_index,
          escrow_pattern,
          amount_cents,
          host_share_cents,
          guest_share_cents,
          funding_deadline,
          currency,
          status,
          metadata
        ) VALUES (
          _plan.id,
          _invitee_id,
          _plan.creator_id,
          _plan.creator_id,
          _invitee_id,
          _idx,
          'B',
          public.gross_amount_cents(_slot_amount)::INT,
          0,
          _slot_amount,
          NOW() + INTERVAL '24 hours',
          COALESCE(_plan.currency, 'NGN'),
          'pending_funding',
          jsonb_build_object(
            'leg', 'guest_slot',
            'plan_invitation', true,
            'invitation_id', p_invitation_id::text
          )
        )
        RETURNING id INTO _escrow_id;

        UPDATE public.plans SET
          status = 'negotiating'::public.plan_status,
          accepted_guest_count = COALESCE(accepted_guest_count, 0) + 1,
          accepted_guest_amounts_sum_cents =
            COALESCE(accepted_guest_amounts_sum_cents, 0) + _slot_amount,
          current_suggested_share_cents = public.calculate_group_suggested_share(_plan.id),
          updated_at = NOW()
        WHERE id = _plan.id;
      ELSE
        _total := public.plan_total_cost_cents(_plan);

        IF _plan.escrow_pattern = 'C' THEN
          _host_share := 0;
          _guest_share := _total;
          _payer_id := _invitee_id;
          _payee_id := _plan.creator_id;
        ELSE
          _host_share := FLOOR(
            (_total::NUMERIC * COALESCE(_plan.host_contribution_bps, 5000)::NUMERIC) / 10000
          )::BIGINT;
          _guest_share := _total - _host_share;
          _payer_id := _plan.creator_id;
          _payee_id := _invitee_id;
        END IF;

        INSERT INTO public.escrow_transactions (
          plan_id,
          payer_id,
          payee_id,
          host_id,
          guest_id,
          escrow_pattern,
          amount_cents,
          host_share_cents,
          guest_share_cents,
          funding_deadline,
          currency,
          status,
          metadata
        ) VALUES (
          _plan.id,
          _payer_id,
          _payee_id,
          _plan.creator_id,
          _invitee_id,
          _plan.escrow_pattern,
          public.gross_amount_cents(_total)::INT,
          _host_share,
          _guest_share,
          CASE
            WHEN COALESCE(_plan.is_mood_plan, false) THEN NOW() + INTERVAL '1 hour'
            ELSE NOW() + INTERVAL '24 hours'
          END,
          COALESCE(_plan.currency, 'NGN'),
          'pending_funding',
          jsonb_build_object('plan_invitation', true, 'invitation_id', p_invitation_id::text)
        )
        RETURNING id INTO _escrow_id;

        UPDATE public.plans SET
          status = 'agreed'::public.plan_status,
          agreed_price_cents = _total,
          agreed_scheduled_at = COALESCE(_plan.agreed_scheduled_at, _plan.scheduled_at),
          agreed_location = COALESCE(_plan.agreed_location, _plan.location_label),
          accepted_guest_count = 1,
          updated_at = NOW()
        WHERE id = _plan.id;
      END IF;
    END IF;

    PERFORM public.create_notification(
      _invitation.host_id,
      'plan_invitation_accepted',
      'Invitation accepted',
      format('%s accepted your invitation to join the plan.', COALESCE(_invitee_name, 'Your guest')),
      jsonb_build_object(
        'href', '/plan/' || _invitation.plan_id::text || '/requests',
        'planId', _invitation.plan_id::text,
        'invitationId', p_invitation_id::text
      ),
      'medium',
      NULL
    );

    RETURN jsonb_build_object(
      'action', 'accepted',
      'isNegotiable', COALESCE(_plan.is_negotiable, true),
      'offerId', _offer_id,
      'escrowId', _escrow_id,
      'slotAmountCents', _slot_amount
    );

  ELSIF p_action = 'decline' THEN
    IF p_decline_reason IS NULL OR trim(p_decline_reason) = '' THEN
      RAISE EXCEPTION 'decline_reason_required';
    END IF;

    UPDATE public.plan_invitations
    SET
      status = 'declined',
      slot_held = FALSE,
      responded_at = NOW(),
      decline_reason = trim(p_decline_reason),
      decline_reason_other = CASE
        WHEN trim(p_decline_reason) = 'Other' THEN nullif(trim(p_decline_reason_other), '')
        ELSE NULL
      END
    WHERE id = p_invitation_id;

    PERFORM public.create_notification(
      _invitation.host_id,
      'plan_invitation_declined',
      'Invitation declined',
      format('%s declined your invitation.', COALESCE(_invitee_name, 'Your guest')),
      jsonb_build_object(
        'href', '/plan/' || _invitation.plan_id::text || '/requests',
        'planId', _invitation.plan_id::text
      ),
      'medium',
      NULL
    );

    RETURN jsonb_build_object('action', 'declined');
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_plan_invitation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_plan_invitation(UUID, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
