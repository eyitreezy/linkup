-- Dynamic split shares for group plans (pattern B): per-guest negotiated escrow + host close-out payment.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS accepted_guest_amounts_sum_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_suggested_share_cents BIGINT,
  ADD COLUMN IF NOT EXISTS group_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_escrow_id UUID REFERENCES public.escrow_transactions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.plans.accepted_guest_amounts_sum_cents IS
  'Running sum of accepted guest negotiated amounts (group split pattern B).';
COMMENT ON COLUMN public.plans.current_suggested_share_cents IS
  'Formula-based suggested per-person share for remaining slots (group split).';
COMMENT ON COLUMN public.plans.group_closed_at IS
  'When host closed the group — no further guest acceptances.';
COMMENT ON COLUMN public.plans.host_escrow_id IS
  'Host escrow row created on close_group_and_create_host_escrow.';

CREATE OR REPLACE FUNCTION public.plan_total_cost_cents(p_plan public.plans)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p_plan.starting_price_cents, p_plan.agreed_price_cents, 0)::bigint;
$$;

CREATE OR REPLACE FUNCTION public.is_group_split_dynamic_plan(p_plan public.plans)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p_plan.is_group_plan, false)
    AND p_plan.escrow_pattern = 'B'
    AND COALESCE(p_plan.is_paid, false);
$$;

CREATE OR REPLACE FUNCTION public.calculate_group_suggested_share(p_plan_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _remaining_cost BIGINT;
  _remaining_slots INT;
  _total BIGINT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.is_group_split_dynamic_plan(_plan) THEN
    RETURN NULL;
  END IF;

  _total := public.plan_total_cost_cents(_plan);
  _remaining_cost := _total - COALESCE(_plan.accepted_guest_amounts_sum_cents, 0);
  _remaining_slots := (COALESCE(_plan.max_guests, 1) - COALESCE(_plan.accepted_guest_count, 0)) + 1;

  IF _remaining_slots <= 0 OR _remaining_cost <= 0 THEN
    RETURN 0;
  END IF;

  RETURN CEIL(_remaining_cost::NUMERIC / _remaining_slots)::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_plan_escrow_fully_funded(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _all_funded BOOLEAN;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF public.is_group_split_dynamic_plan(_plan) THEN
    IF _plan.host_escrow_id IS NULL THEN
      RETURN FALSE;
    END IF;

    SELECT NOT EXISTS (
      SELECT 1
      FROM public.escrow_transactions e
      WHERE e.plan_id = p_plan_id
        AND e.status NOT IN ('funded', 'active', 'released')
    ) INTO _all_funded;

    RETURN COALESCE(_all_funded, FALSE);
  END IF;

  IF _plan.escrow_pattern = 'B' AND NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN (
      EXISTS (
        SELECT 1 FROM public.escrow_transactions
        WHERE plan_id = p_plan_id AND host_funded_at IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.escrow_transactions
        WHERE plan_id = p_plan_id AND guest_funded_at IS NOT NULL
      )
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.escrow_transactions
    WHERE plan_id = p_plan_id AND status IN ('funded', 'active', 'released')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.try_activate_group_split_plan(p_plan_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.check_plan_escrow_fully_funded(p_plan_id) THEN
    UPDATE public.plans
    SET status = 'active'::public.plan_status, updated_at = now()
    WHERE id = p_plan_id
      AND status = 'awaiting_payment'::public.plan_status;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escrow_try_activate_group_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('funded', 'active') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.try_activate_group_split_plan(NEW.plan_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escrow_try_activate_group_split ON public.escrow_transactions;
CREATE TRIGGER trg_escrow_try_activate_group_split
  AFTER INSERT OR UPDATE OF status, host_funded_at, guest_funded_at ON public.escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_escrow_try_activate_group_split();

CREATE OR REPLACE FUNCTION public.close_group_and_create_host_escrow(p_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _host_id UUID := auth.uid();
  _host_share_cents BIGINT;
  _host_escrow_id UUID;
  _guest RECORD;
  _idx INT;
BEGIN
  IF _host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id != _host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF NOT public.is_group_split_dynamic_plan(_plan) THEN
    RAISE EXCEPTION 'not_group_split_plan';
  END IF;

  IF COALESCE(_plan.accepted_guest_count, 0) = 0 THEN
    RAISE EXCEPTION 'no_guests_accepted';
  END IF;

  IF _plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  _host_share_cents := public.plan_total_cost_cents(_plan) - COALESCE(_plan.accepted_guest_amounts_sum_cents, 0);

  IF _host_share_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_host_share';
  END IF;

  SELECT COALESCE(MAX(group_plan_index), 0) + 1 INTO _idx
  FROM public.escrow_transactions WHERE plan_id = p_plan_id;

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
    p_plan_id,
    _host_id,
    _host_id,
    _host_id,
    NULL,
    _idx,
    'B',
    _host_share_cents,
    _host_share_cents,
    0,
    now() + interval '24 hours',
    COALESCE(_plan.currency, 'NGN'),
    'pending_funding',
    jsonb_build_object('leg', 'host_close', 'dynamic_group_split', true)
  )
  RETURNING id INTO _host_escrow_id;

  UPDATE public.plans
  SET
    group_closed_at = now(),
    host_escrow_id = _host_escrow_id,
    status = 'awaiting_payment'::public.plan_status,
    updated_at = now()
  WHERE id = p_plan_id;

  FOR _guest IN
    SELECT DISTINCT bidder_id FROM public.plan_offers
    WHERE plan_id = p_plan_id AND status = 'accepted'::public.offer_status
  LOOP
    PERFORM public.create_notification(
      _guest.bidder_id,
      'group_closed',
      'The host has closed the group',
      'Fund your share to confirm the meetup.',
      jsonb_build_object(
        'href', '/plan/' || p_plan_id || '/agreement',
        'planId', p_plan_id::text
      )
    );
  END LOOP;

  RETURN _host_escrow_id;
END;
$$;

-- Extend host_respond_to_offer: group split dynamic acceptance creates guest escrow + recalculates share.
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
        RAISE EXCEPTION 'invalid_guest_amount';
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
          v_guest_amount,
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

REVOKE ALL ON FUNCTION public.calculate_group_suggested_share(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_group_suggested_share(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_plan_escrow_fully_funded(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_plan_escrow_fully_funded(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.close_group_and_create_host_escrow(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_group_and_create_host_escrow(UUID) TO authenticated;

UPDATE public.plans
SET current_suggested_share_cents = public.calculate_group_suggested_share(id)
WHERE is_group_plan = true
  AND escrow_pattern = 'B'
  AND COALESCE(is_paid, false) = true
  AND current_suggested_share_cents IS NULL;

NOTIFY pgrst, 'reload schema';
