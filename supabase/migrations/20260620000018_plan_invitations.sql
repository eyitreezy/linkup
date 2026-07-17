-- Host-initiated plan invitations (group plans only).

CREATE TABLE IF NOT EXISTS public.plan_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email TEXT,
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  slot_held BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  CONSTRAINT plan_invitations_invitee_required CHECK (
    invitee_user_id IS NOT NULL OR invitee_email IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_invitations_user_per_plan
  ON public.plan_invitations(plan_id, invitee_user_id)
  WHERE invitee_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_invitations_email_per_plan
  ON public.plan_invitations(plan_id, lower(invitee_email))
  WHERE invitee_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plan_invitations_plan_status
  ON public.plan_invitations(plan_id, status);

CREATE INDEX IF NOT EXISTS idx_plan_invitations_invitee
  ON public.plan_invitations(invitee_user_id)
  WHERE invitee_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plan_invitations_token
  ON public.plan_invitations(invitation_token);

CREATE INDEX IF NOT EXISTS idx_plan_invitations_expires_pending
  ON public.plan_invitations(expires_at)
  WHERE status = 'pending';

ALTER TABLE public.plan_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_read_own_plan_invitations"
  ON public.plan_invitations FOR SELECT
  USING (host_id = auth.uid());

CREATE POLICY "invitee_read_own_invitations"
  ON public.plan_invitations FOR SELECT
  USING (invitee_user_id = auth.uid());

CREATE POLICY "host_insert_invitations"
  ON public.plan_invitations FOR INSERT
  WITH CHECK (
    host_id = auth.uid()
    AND plan_id IN (SELECT id FROM public.plans WHERE creator_id = auth.uid())
  );

CREATE POLICY "host_update_own_plan_invitations"
  ON public.plan_invitations FOR UPDATE
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_invitations;

CREATE OR REPLACE FUNCTION public.get_plan_available_slots(p_plan_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _held_invitations INT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INT INTO _held_invitations
  FROM public.plan_invitations
  WHERE plan_id = p_plan_id
    AND status = 'pending'
    AND slot_held = TRUE;

  RETURN GREATEST(
    0,
    COALESCE(_plan.max_guests, 1)
      - COALESCE(_plan.accepted_guest_count, 0)
      - COALESCE(_held_invitations, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._plan_invitation_expires_at(p_plan public.plans)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT LEAST(
    NOW() + INTERVAL '7 days',
    COALESCE(p_plan.scheduled_at - INTERVAL '48 hours', NOW() + INTERVAL '7 days')
  );
$$;

CREATE OR REPLACE FUNCTION public.send_plan_invitation_to_user(
  p_plan_id UUID,
  p_invitee_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _invitation_id UUID;
  _host_name TEXT;
  _invitee_name TEXT;
BEGIN
  IF _host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_invitee_user_id = _host_id THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id != _host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false) THEN
    RAISE EXCEPTION 'invitations_group_only';
  END IF;

  IF _plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  IF public.get_plan_available_slots(p_plan_id) <= 0 THEN
    RAISE EXCEPTION 'no_slots_available';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_invitations
    WHERE plan_id = p_plan_id
      AND invitee_user_id = p_invitee_user_id
      AND status NOT IN ('declined', 'expired', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'invitation_already_exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_offers
    WHERE plan_id = p_plan_id
      AND bidder_id = p_invitee_user_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'guest_already_accepted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.escrow_transactions
    WHERE plan_id = p_plan_id AND guest_id = p_invitee_user_id
  ) THEN
    RAISE EXCEPTION 'guest_already_has_escrow';
  END IF;

  INSERT INTO public.plan_invitations (
    plan_id, host_id, invitee_user_id, expires_at
  ) VALUES (
    p_plan_id,
    _host_id,
    p_invitee_user_id,
    public._plan_invitation_expires_at(_plan)
  )
  RETURNING id INTO _invitation_id;

  SELECT display_name INTO _host_name FROM public.profiles WHERE user_id = _host_id;
  SELECT display_name INTO _invitee_name FROM public.profiles WHERE user_id = p_invitee_user_id;

  PERFORM public.create_notification(
    p_invitee_user_id,
    'plan_invitation_received',
    'You have been invited to a meetup',
    format('%s invited you to join a plan.', COALESCE(_host_name, 'Someone')),
    jsonb_build_object(
      'href', '/plan/' || p_plan_id::text || '/invitation/' || _invitation_id::text,
      'planId', p_plan_id::text,
      'invitationId', _invitation_id::text,
      'hostName', _host_name
    ),
    'medium',
    NULL
  );

  RETURN _invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_plan_invitation(
  p_invitation_id UUID,
  p_action TEXT
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
          _slot_amount,
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
          _total,
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
    UPDATE public.plan_invitations
    SET status = 'declined', slot_held = FALSE, responded_at = NOW()
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

CREATE OR REPLACE FUNCTION public.search_users_for_invitation(
  p_query TEXT,
  p_plan_id UUID
)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  is_kyc_verified BOOLEAN,
  already_invited BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q TEXT := trim(COALESCE(p_query, ''));
BEGIN
  IF length(_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    NULL::TEXT AS username,
    p.avatar_url,
    (u.verification_status = 'verified') AS is_kyc_verified,
    EXISTS (
      SELECT 1 FROM public.plan_invitations pi
      WHERE pi.plan_id = p_plan_id
        AND pi.invitee_user_id = p.user_id
        AND pi.status NOT IN ('declined', 'expired', 'cancelled')
    ) AS already_invited
  FROM public.profiles p
  JOIN public.users u ON u.id = p.user_id
  WHERE
    p.user_id != auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_offers po
      WHERE po.plan_id = p_plan_id
        AND po.bidder_id = p.user_id
        AND po.status = 'accepted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.escrow_transactions et
      WHERE et.plan_id = p_plan_id AND et.guest_id = p.user_id
    )
    AND (
      p.display_name ILIKE '%' || _q || '%'
      OR u.email ILIKE '%' || _q || '%'
    )
  ORDER BY
    CASE WHEN p.display_name ILIKE _q || '%' THEN 0 ELSE 1 END,
    p.display_name
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_invitation_after_signup(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _invitation public.plan_invitations%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _invitation
  FROM public.plan_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false);
  END IF;

  IF _invitation.invitee_user_id IS NOT NULL
     AND _invitation.invitee_user_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'invitation_token_mismatch';
  END IF;

  UPDATE public.plan_invitations
  SET invitee_user_id = _user_id
  WHERE id = _invitation.id;

  PERFORM public.create_notification(
    _user_id,
    'plan_invitation_received',
    'You have a pending invitation',
    'Someone invited you to join a plan. Complete your verification to respond.',
    jsonb_build_object(
      'href', '/plan/' || _invitation.plan_id::text || '/invitation/' || _invitation.id::text,
      'planId', _invitation.plan_id::text,
      'invitationId', _invitation.id::text
    ),
    'medium',
    NULL
  );

  RETURN jsonb_build_object(
    'linked', true,
    'planId', _invitation.plan_id,
    'invitationId', _invitation.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_plan_available_slots(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_plan_available_slots(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.send_plan_invitation_to_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_plan_invitation_to_user(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_to_plan_invitation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_plan_invitation(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.search_users_for_invitation(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users_for_invitation(TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.link_invitation_after_signup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_invitation_after_signup(UUID) TO authenticated;
