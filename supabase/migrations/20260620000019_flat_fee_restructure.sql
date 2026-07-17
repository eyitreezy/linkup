-- Flat 5% additive platform fee model.
-- Keep in sync with planFinancialConfig.ts (web + mobile).

-- ---------------------------------------------------------------------------
-- Fee helpers (budget vs gross)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_fee_cents_for_amount(p_amount_cents BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF COALESCE(p_amount_cents, 0) <= 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(p_amount_cents * 500::NUMERIC / 10000)::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.gross_amount_cents(p_budget_cents BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN COALESCE(p_budget_cents, 0) + public.platform_fee_cents_for_amount(p_budget_cents);
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_from_gross_amount_cents(p_gross_cents BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF COALESCE(p_gross_cents, 0) <= 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(p_gross_cents::NUMERIC / 1.05)::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fee_from_gross_amount_cents(p_gross_cents BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN COALESCE(p_gross_cents, 0) - public.budget_from_gross_amount_cents(p_gross_cents);
END;
$$;

COMMENT ON FUNCTION public.platform_fee_cents_for_amount(BIGINT) IS
  '5% fee on plan budget (kobo). escrow_transactions.amount_cents stores gross (budget + fee).';

-- ---------------------------------------------------------------------------
-- Goodwill: max 50% of fee offset
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_goodwill_to_fee(
  p_user_id UUID,
  p_fee_cents BIGINT,
  p_reference TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_max_offset BIGINT := FLOOR(GREATEST(0, COALESCE(p_fee_cents, 0)) * 50::NUMERIC / 100);
  v_remaining BIGINT := v_max_offset;
  v_applied_total BIGINT := 0;
  v_available BIGINT;
  v_apply_now BIGINT;
BEGIN
  IF p_user_id IS NULL OR v_remaining <= 0 THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT id, amount, used_amount, expires_at
    FROM public.goodwill_credits
    WHERE user_id = p_user_id
      AND expires_at > now()
      AND used_amount < amount
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_available := v_row.amount - v_row.used_amount;
    v_apply_now := LEAST(v_available, v_remaining);

    UPDATE public.goodwill_credits
    SET used_amount = used_amount + v_apply_now::INT
    WHERE id = v_row.id;

    v_applied_total := v_applied_total + v_apply_now;
    v_remaining := v_remaining - v_apply_now;
  END LOOP;

  IF v_applied_total > 0 THEN
    INSERT INTO public.wallet_ledger (user_id, type, source, amount, reference_id, is_display_only)
    VALUES (p_user_id, 'credit', 'goodwill', v_applied_total::INT, p_reference, TRUE);

    PERFORM public.append_financial_event(
      p_user_id,
      'goodwill_applied',
      v_applied_total::INT,
      'goodwill_applied:' || COALESCE(p_reference, gen_random_uuid()::text),
      jsonb_build_object('reference', p_reference)
    );
  END IF;

  RETURN v_applied_total;
END;
$$;

-- ---------------------------------------------------------------------------
-- Release: fee from gross escrow amount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._escrow_release_internal(
  p_escrow_id UUID,
  p_auto_released BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_full_fee INT;
  v_goodwill_applied INT := 0;
  v_net_fee INT;
  v_net INT;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE id = p_escrow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_not_found';
  END IF;

  IF v_escrow.status = 'released' THEN
    RETURN jsonb_build_object('status', 'already_released', 'escrow_id', p_escrow_id);
  END IF;

  IF v_escrow.status = 'disputed' THEN
    RAISE EXCEPTION 'escrow_disputed';
  END IF;

  IF v_escrow.status NOT IN ('funded', 'active') THEN
    RAISE EXCEPTION 'escrow_not_releasable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.escrow_disputes d
    WHERE d.escrow_id = p_escrow_id
      AND d.status IN ('open', 'under_review')
  ) THEN
    RAISE EXCEPTION 'escrow_dispute_open';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_escrow.plan_id;
  IF v_plan.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'plan_not_completed';
  END IF;

  v_full_fee := public.fee_from_gross_amount_cents(v_escrow.amount_cents)::INT;

  IF v_escrow.payee_id IS NOT NULL AND v_full_fee > 0 THEN
    v_goodwill_applied := public._apply_goodwill_to_fee(
      v_escrow.payee_id,
      v_full_fee,
      v_escrow.id::text || CASE WHEN p_auto_released THEN ':auto' ELSE ':manual' END
    )::INT;
  END IF;

  v_net_fee := GREATEST(0, v_full_fee - v_goodwill_applied);
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_net_fee);
  v_ref := v_escrow.id::text || CASE WHEN p_auto_released THEN ':auto' ELSE ':manual' END;

  IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
    PERFORM public._wallet_credit_internal(
      v_escrow.payee_id,
      v_net,
      'escrow_release',
      v_ref,
      jsonb_build_object(
        'plan_id', v_escrow.plan_id,
        'platform_fee_cents', v_net_fee,
        'platform_fee_full_cents', v_full_fee,
        'goodwill_applied_cents', v_goodwill_applied,
        'escrow_pattern', v_escrow.escrow_pattern,
        'auto_released', p_auto_released
      )
    );
  END IF;

  UPDATE public.escrow_transactions
  SET
    status = 'released',
    released_at = now(),
    platform_fee_cents = v_net_fee,
    goodwill_applied_cents = v_goodwill_applied,
    metadata = COALESCE(metadata, '{}'::jsonb) || CASE
      WHEN p_auto_released THEN jsonb_build_object('auto_released', true)
      ELSE '{}'::jsonb
    END,
    updated_at = now()
  WHERE id = p_escrow_id;

  RETURN jsonb_build_object(
    'status', 'released',
    'escrow_id', p_escrow_id,
    'net_amount_cents', v_net,
    'platform_fee_cents', v_net_fee,
    'platform_fee_full_cents', v_full_fee,
    'goodwill_applied_cents', v_goodwill_applied,
    'payee_id', v_escrow.payee_id,
    'auto_released', p_auto_released
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Escrow creation: store gross in amount_cents
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_plan_escrow_transaction(
  p_plan_id UUID,
  p_offer_id UUID,
  p_payer_id UUID,
  p_payee_id UUID,
  p_host_id UUID,
  p_guest_id UUID,
  p_amount_cents INT,
  p_host_share_cents INT,
  p_guest_share_cents INT,
  p_escrow_pattern TEXT,
  p_currency TEXT,
  p_funding_deadline TIMESTAMPTZ,
  p_group_plan_index INT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
  v_is_group BOOLEAN;
  v_existing UUID;
  v_gross_amount INT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_actor NOT IN (p_payer_id, p_payee_id, p_host_id, p_guest_id) THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_actor AND u.verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'verification_required';
  END IF;

  v_gross_amount := public.gross_amount_cents(p_amount_cents)::INT;

  SELECT p.is_group_plan INTO v_is_group FROM public.plans p WHERE p.id = p_plan_id;

  IF v_is_group THEN
    SELECT e.id INTO v_existing
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id AND e.guest_id = p_guest_id
    LIMIT 1;
  ELSE
    SELECT e.id INTO v_existing
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE public.plans
    SET status = CASE
      WHEN v_is_group THEN 'negotiating'::public.plan_status
      ELSE 'awaiting_payment'::public.plan_status
    END
    WHERE id = p_plan_id AND status = 'agreed'::public.plan_status;
    RETURN v_existing;
  END IF;

  IF NOT public.escrow_agreement_confirmations_met(p_plan_id, p_guest_id) THEN
    RAISE EXCEPTION 'both_parties_must_confirm';
  END IF;

  INSERT INTO public.escrow_transactions (
    plan_id,
    payer_id,
    payee_id,
    host_id,
    guest_id,
    offer_id,
    group_plan_index,
    escrow_pattern,
    amount_cents,
    host_share_cents,
    guest_share_cents,
    funding_deadline,
    currency,
    status,
    metadata
  )
  VALUES (
    p_plan_id,
    p_payer_id,
    p_payee_id,
    p_host_id,
    p_guest_id,
    p_offer_id,
    p_group_plan_index,
    p_escrow_pattern,
    v_gross_amount,
    p_host_share_cents,
    p_guest_share_cents,
    p_funding_deadline,
    COALESCE(p_currency, 'NGN'),
    'pending_funding'::public.escrow_status,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  UPDATE public.plans
  SET status = CASE
    WHEN v_is_group THEN 'negotiating'::public.plan_status
    ELSE 'awaiting_payment'::public.plan_status
  END
  WHERE id = p_plan_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Group close: host escrow stores gross
-- ---------------------------------------------------------------------------
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
    public.gross_amount_cents(_host_share_cents)::INT,
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

-- Patch host_respond_to_offer guest escrow insert (amount = gross of budget share).
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

-- admin_resolve_escrow_dispute: fee from gross
CREATE OR REPLACE FUNCTION public.admin_resolve_escrow_dispute(
  p_dispute_id UUID,
  p_decision TEXT,
  p_split_bps INT DEFAULT NULL,
  p_resolution_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute public.escrow_disputes%ROWTYPE;
  v_escrow public.escrow_transactions%ROWTYPE;
  v_full_fee INT;
  v_goodwill_applied INT := 0;
  v_net_fee INT;
  v_net INT;
  v_payee_amount INT;
  v_payer_amount INT;
  v_ref TEXT;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF p_decision NOT IN ('release', 'refund', 'split') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  IF p_decision = 'split' AND (p_split_bps IS NULL OR p_split_bps < 0 OR p_split_bps > 10000) THEN
    RAISE EXCEPTION 'invalid_split_bps';
  END IF;

  SELECT * INTO v_dispute FROM public.escrow_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;

  IF v_dispute.status IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'dispute_already_closed';
  END IF;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE id = v_dispute.escrow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_not_found';
  END IF;

  IF v_escrow.status NOT IN ('disputed', 'funded', 'active') THEN
    RAISE EXCEPTION 'escrow_not_resolvable';
  END IF;

  v_full_fee := public.fee_from_gross_amount_cents(v_escrow.amount_cents)::INT;
  v_ref := v_escrow.id::text || ':admin:' || p_decision;

  IF p_decision IN ('release', 'split') AND v_escrow.payee_id IS NOT NULL AND v_full_fee > 0 THEN
    v_goodwill_applied := public._apply_goodwill_to_fee(
      v_escrow.payee_id,
      v_full_fee,
      v_ref || ':goodwill'
    )::INT;
  END IF;

  v_net_fee := GREATEST(0, v_full_fee - v_goodwill_applied);
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_net_fee);

  IF p_decision = 'release' THEN
    IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payee_id,
        v_net,
        'escrow_release',
        v_ref,
        jsonb_build_object(
          'escrow_dispute_id', p_dispute_id,
          'plan_id', v_escrow.plan_id,
          'platform_fee_cents', v_net_fee,
          'goodwill_applied_cents', v_goodwill_applied
        )
      );
    END IF;
    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = now(),
      platform_fee_cents = v_net_fee,
      goodwill_applied_cents = v_goodwill_applied,
      updated_at = now()
    WHERE id = v_escrow.id;

  ELSIF p_decision = 'refund' THEN
    IF v_escrow.amount_cents > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_escrow.amount_cents,
        'refund',
        v_ref,
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'plan_id', v_escrow.plan_id)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET status = 'refunded', released_at = now(), updated_at = now()
    WHERE id = v_escrow.id;

  ELSIF p_decision = 'split' THEN
    v_payee_amount := ROUND((v_net::numeric * p_split_bps) / 10000.0)::INT;
    v_payer_amount := GREATEST(0, v_escrow.amount_cents - v_payee_amount - v_net_fee);
    IF v_payee_amount > 0 AND v_escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payee_id,
        v_payee_amount,
        'escrow_release',
        v_ref || ':payee',
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'split_bps', p_split_bps)
      );
    END IF;
    IF v_payer_amount > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_payer_amount,
        'refund',
        v_ref || ':payer',
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'split_bps', p_split_bps)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = now(),
      platform_fee_cents = v_net_fee,
      goodwill_applied_cents = v_goodwill_applied,
      updated_at = now()
    WHERE id = v_escrow.id;
  END IF;

  UPDATE public.escrow_disputes
  SET
    status = 'resolved',
    resolved_at = now(),
    admin_resolution = p_decision,
    admin_note = COALESCE(p_resolution_note, admin_note)
  WHERE id = p_dispute_id;

  INSERT INTO public.escrow_dispute_admin_actions (escrow_dispute_id, admin_user_id, action, detail)
  VALUES (
    p_dispute_id,
    p_admin_id,
    'escrow_' || p_decision,
    jsonb_build_object(
      'decision', p_decision,
      'split_bps', p_split_bps,
      'note', p_resolution_note,
      'escrow_id', v_escrow.id,
      'goodwill_applied_cents', v_goodwill_applied
    )
  );
END;
$$;

-- Join request approval: escrow amount_cents = gross(budget share)
CREATE OR REPLACE FUNCTION public.host_respond_to_join_request(
  p_request_id UUID,
  p_action TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host_id UUID := auth.uid();
  _request public.plan_join_requests%ROWTYPE;
  _plan public.plans%ROWTYPE;
  _guest_escrow_id UUID;
  _slot_amount BIGINT;
  _total BIGINT;
  _host_share BIGINT;
  _guest_share BIGINT;
  _payer_id UUID;
  _payee_id UUID;
  _guest_name TEXT;
  _idx INT;
  _is_group_split BOOLEAN;
BEGIN
  IF _host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _request FROM public.plan_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = _request.plan_id FOR UPDATE;
  IF _plan.creator_id != _host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF _request.status != 'pending' THEN
    RAISE EXCEPTION 'request_already_responded';
  END IF;

  SELECT display_name INTO _guest_name FROM public.profiles WHERE user_id = _request.requester_id;

  IF p_action = 'approve' THEN
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
        _request.requester_id,
        _plan.creator_id,
        _plan.creator_id,
        _request.requester_id,
        _idx,
        'B',
        public.gross_amount_cents(_slot_amount)::INT,
        0,
        _slot_amount,
        now() + interval '24 hours',
        COALESCE(_plan.currency, 'NGN'),
        'pending_funding',
        jsonb_build_object('leg', 'guest_slot', 'join_request', true, 'request_id', p_request_id::text)
      )
      RETURNING id INTO _guest_escrow_id;

      UPDATE public.plans SET
        status = 'negotiating'::public.plan_status,
        accepted_guest_count = COALESCE(accepted_guest_count, 0) + 1,
        accepted_guest_amounts_sum_cents =
          COALESCE(accepted_guest_amounts_sum_cents, 0) + _slot_amount,
        current_suggested_share_cents = public.calculate_group_suggested_share(_plan.id),
        updated_at = now()
      WHERE id = _plan.id;

    ELSE
      _total := public.plan_total_cost_cents(_plan);

      IF _plan.escrow_pattern = 'C' THEN
        _host_share := 0;
        _guest_share := _total;
        _payer_id := _request.requester_id;
        _payee_id := _plan.creator_id;
      ELSE
        _host_share := FLOOR(
          (_total::NUMERIC * COALESCE(_plan.host_contribution_bps, 5000)::NUMERIC) / 10000
        )::BIGINT;
        _guest_share := _total - _host_share;
        _payer_id := _plan.creator_id;
        _payee_id := _request.requester_id;
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
        _request.requester_id,
        _plan.escrow_pattern,
        public.gross_amount_cents(_total)::INT,
        _host_share,
        _guest_share,
        CASE
          WHEN COALESCE(_plan.is_mood_plan, false) THEN now() + interval '1 hour'
          ELSE now() + interval '24 hours'
        END,
        COALESCE(_plan.currency, 'NGN'),
        'pending_funding',
        jsonb_build_object('join_request', true, 'request_id', p_request_id::text)
      )
      RETURNING id INTO _guest_escrow_id;

      UPDATE public.plans SET
        status = 'agreed'::public.plan_status,
        agreed_price_cents = _total,
        agreed_scheduled_at = COALESCE(_plan.agreed_scheduled_at, _plan.scheduled_at),
        agreed_location = COALESCE(_plan.agreed_location, _plan.location_label),
        accepted_guest_count = 1,
        updated_at = now()
      WHERE id = _plan.id;
    END IF;

    UPDATE public.plan_join_requests SET
      status = 'approved',
      responded_at = now(),
      updated_at = now()
    WHERE id = p_request_id;

    PERFORM public.create_notification(
      _request.requester_id,
      'join_request_approved',
      'Your request was approved!',
      'Your request to join has been approved. Fund your share to secure your slot.',
      jsonb_build_object(
        'href', '/escrow/' || _guest_escrow_id::text,
        'planId', _plan.id::text,
        'requestId', p_request_id::text,
        'amountCents', _slot_amount,
        'escrowId', _guest_escrow_id::text
      ),
      'medium',
      NULL
    );

  ELSIF p_action = 'decline' THEN
    UPDATE public.plan_join_requests SET
      status = 'declined',
      responded_at = now(),
      updated_at = now()
    WHERE id = p_request_id;

    PERFORM public.create_notification(
      _request.requester_id,
      'join_request_declined',
      'Request not approved',
      'Your request to join was not approved. Explore other plans on LinkUp.',
      jsonb_build_object(
        'href', '/discover',
        'planId', _plan.id::text
      ),
      'medium',
      NULL
    );
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

-- Plan invitation accept: escrow amount_cents = gross(budget share)
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

NOTIFY pgrst, 'reload schema';
