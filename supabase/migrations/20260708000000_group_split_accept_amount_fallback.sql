-- Group split accept: fall back to suggested share when offer has no amount.
-- Also store gross escrow amount (budget + 5% fee) on guest slot creation.

CREATE OR REPLACE FUNCTION public.host_respond_to_offer(
  p_offer_id UUID,
  p_action TEXT,
  p_counter_amount_cents INTEGER DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_proposed_scheduled_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.plan_offers%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_host_id UUID := auth.uid();
  v_agreed_amount INTEGER;
  v_merged_schedule TIMESTAMPTZ;
  v_is_group_split BOOLEAN;
  v_guest_amount INTEGER;
  v_guest_escrow_id UUID;
  v_idx INT;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_offer FROM public.plan_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_offer.plan_id FOR UPDATE;
  IF v_plan.creator_id != v_host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF v_plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  IF v_offer.awaiting_response_from IS DISTINCT FROM 'host' THEN
    RAISE EXCEPTION 'not_your_turn';
  END IF;

  v_is_group_split := public.is_group_split_dynamic_plan(v_plan);

  IF p_action = 'accept' THEN
    UPDATE public.plan_offers SET
      status = 'accepted',
      last_action_by = 'host',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    IF v_is_group_split THEN
      v_guest_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, 0);
      IF v_guest_amount <= 0 THEN
        v_guest_amount := public.resolve_join_request_slot_cents(v_plan)::INTEGER;
      END IF;
      IF v_guest_amount <= 0 THEN
        RAISE EXCEPTION 'invalid_guest_amount';
      END IF;

      IF COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, 0) <= 0 THEN
        UPDATE public.plan_offers SET
          amount_cents = v_guest_amount,
          current_amount_cents = v_guest_amount,
          updated_at = now()
        WHERE id = p_offer_id;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.escrow_transactions
        WHERE plan_id = v_plan.id AND guest_id = v_offer.bidder_id
      ) THEN
        SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO v_idx
        FROM public.escrow_transactions WHERE plan_id = v_plan.id;

        INSERT INTO public.escrow_transactions (
          plan_id,
          offer_id,
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
          v_plan.id,
          p_offer_id,
          v_offer.bidder_id,
          v_plan.creator_id,
          v_plan.creator_id,
          v_offer.bidder_id,
          v_idx,
          'B',
          public.gross_amount_cents(v_guest_amount)::INT,
          0,
          v_guest_amount,
          now() + interval '24 hours',
          COALESCE(v_plan.currency, 'NGN'),
          'pending_funding',
          jsonb_build_object('leg', 'guest_slot', 'dynamic_group_split', true)
        )
        RETURNING id INTO v_guest_escrow_id;
      ELSE
        SELECT id INTO v_guest_escrow_id
        FROM public.escrow_transactions
        WHERE plan_id = v_plan.id AND guest_id = v_offer.bidder_id
        LIMIT 1;
      END IF;

      UPDATE public.plans SET
        status = 'negotiating'::public.plan_status,
        accepted_guest_amounts_sum_cents =
          COALESCE(accepted_guest_amounts_sum_cents, 0) + v_guest_amount,
        current_suggested_share_cents = public.calculate_group_suggested_share(v_plan.id),
        updated_at = now()
      WHERE id = v_plan.id;

      PERFORM public.create_notification(
        v_offer.bidder_id,
        'slot_accepted_fund_now',
        'Your slot is confirmed!',
        'Fund your share to secure your spot on this group plan.',
        jsonb_build_object(
          'href', '/plan/' || v_plan.id || '/agreement',
          'planId', v_plan.id::text,
          'offerId', p_offer_id::text,
          'escrowId', v_guest_escrow_id::text,
          'amountCents', v_guest_amount
        )
      );

    ELSIF COALESCE(v_plan.is_group_plan, false) THEN
      UPDATE public.plans SET
        status = 'negotiating'::public.plan_status,
        updated_at = now()
      WHERE id = v_plan.id;

      PERFORM public.create_notification(
        v_offer.bidder_id,
        'offer_accepted',
        'Your offer was accepted!',
        'Review the agreement and proceed to secure payment when ready.',
        jsonb_build_object(
          'href', '/plan/' || v_plan.id || '/agreement',
          'planId', v_plan.id::text,
          'offerId', p_offer_id::text
        )
      );
    ELSE
      UPDATE public.plan_offers SET status = 'superseded'
      WHERE plan_id = v_plan.id AND id <> p_offer_id
        AND status IN ('pending', 'countered', 'countered_by_host', 'countered_by_guest');

      v_agreed_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, v_plan.starting_price_cents, 0);
      v_merged_schedule := COALESCE(p_proposed_scheduled_at, v_offer.proposed_scheduled_at, v_plan.scheduled_at);

      UPDATE public.plans SET
        status = 'agreed'::public.plan_status,
        accepted_offer_id = p_offer_id,
        agreed_price_cents = CASE WHEN v_agreed_amount > 0 THEN v_agreed_amount ELSE NULL END,
        agreed_scheduled_at = v_merged_schedule,
        agreed_location = COALESCE(v_plan.location_label, agreed_location),
        agreed_notes = COALESCE(v_offer.message, agreed_notes),
        scheduled_at = COALESCE(v_merged_schedule, scheduled_at),
        updated_at = now()
      WHERE id = v_plan.id;

      PERFORM public.create_notification(
        v_offer.bidder_id,
        'offer_accepted',
        'Your offer was accepted!',
        'Review the agreement and proceed to secure payment when ready.',
        jsonb_build_object(
          'href', '/plan/' || v_plan.id || '/agreement',
          'planId', v_plan.id::text,
          'offerId', p_offer_id::text
        )
      );
    END IF;

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'accept', NULL, p_note);

  ELSIF p_action = 'counter' THEN
    IF p_counter_amount_cents IS NULL THEN
      RAISE EXCEPTION 'counter_amount_required';
    END IF;

    UPDATE public.plan_offers SET
      amount_cents = p_counter_amount_cents,
      current_amount_cents = p_counter_amount_cents,
      message = COALESCE(p_note, message),
      proposed_scheduled_at = COALESCE(p_proposed_scheduled_at, proposed_scheduled_at),
      status = 'countered_by_host',
      last_action_by = 'host',
      awaiting_response_from = 'guest',
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_countered',
      'The host made a counter offer',
      'Review their counter and respond.',
      jsonb_build_object(
        'href', '/plan/' || v_plan.id || '/negotiate',
        'planId', v_plan.id::text,
        'offerId', p_offer_id::text
      )
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'counter', p_counter_amount_cents, p_note);

  ELSIF p_action = 'decline' THEN
    UPDATE public.plan_offers SET
      status = 'declined',
      last_action_by = 'host',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_declined',
      'Your offer was not accepted',
      'You can submit a new offer or explore other plans.',
      jsonb_build_object('href', '/plan/' || v_plan.id, 'planId', v_plan.id::text)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'decline', NULL, p_note);
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
