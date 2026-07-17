-- Non-negotiable join requests: fixed formula price, host approve/decline (split B + guest-funded C only).

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_negotiable BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.plans.is_negotiable IS
  'When false on paid split/guest-funded plans, guests request to join at formula price instead of negotiating offers.';

CREATE TABLE IF NOT EXISTS public.plan_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_active_per_guest
  ON public.plan_join_requests(plan_id, requester_id)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_join_requests_plan_id
  ON public.plan_join_requests(plan_id, status);

ALTER TABLE public.plan_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester_read_own_requests"
  ON public.plan_join_requests FOR SELECT
  USING (requester_id = auth.uid());

CREATE POLICY "host_read_plan_requests"
  ON public.plan_join_requests FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM public.plans WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "requester_insert_own"
  ON public.plan_join_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_join_requests;

CREATE OR REPLACE FUNCTION public.plan_allows_join_requests(p_plan public.plans)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p_plan.is_paid, false)
    AND COALESCE(p_plan.is_negotiable, true) = false
    AND p_plan.escrow_pattern IN ('B', 'C');
$$;

CREATE OR REPLACE FUNCTION public.resolve_join_request_slot_cents(p_plan public.plans)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total BIGINT;
  _host_share BIGINT;
BEGIN
  IF p_plan.escrow_pattern = 'C' THEN
    RETURN COALESCE(p_plan.starting_price_cents, 0)::BIGINT;
  END IF;

  IF p_plan.escrow_pattern = 'B' THEN
    IF public.is_group_split_dynamic_plan(p_plan) THEN
      RETURN COALESCE(
        p_plan.current_suggested_share_cents,
        public.calculate_group_suggested_share(p_plan.id),
        0
      );
    END IF;

    _total := public.plan_total_cost_cents(p_plan);
    _host_share := FLOOR(
      (_total::NUMERIC * COALESCE(p_plan.host_contribution_bps, 5000)::NUMERIC) / 10000
    )::BIGINT;
    RETURN GREATEST(0, _total - _host_share);
  END IF;

  RAISE EXCEPTION 'join_request_not_applicable';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_join_request(
  p_plan_id UUID,
  p_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _request_id UUID;
  _guest_name TEXT;
  _accepted_count INT;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id = _requester_id THEN
    RAISE EXCEPTION 'host_cannot_request';
  END IF;

  IF NOT public.plan_allows_join_requests(_plan) THEN
    IF COALESCE(_plan.is_negotiable, true) THEN
      RAISE EXCEPTION 'plan_is_negotiable_use_offer_flow';
    END IF;
    RAISE EXCEPTION 'join_request_not_applicable';
  END IF;

  IF _plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  _accepted_count := COALESCE(_plan.accepted_guest_count, 0);
  IF COALESCE(_plan.is_group_plan, false) THEN
    IF _accepted_count >= COALESCE(_plan.max_guests, 1) THEN
      RAISE EXCEPTION 'plan_full';
    END IF;
  ELSE
    IF _plan.accepted_offer_id IS NOT NULL OR _accepted_count > 0 THEN
      RAISE EXCEPTION 'plan_full';
    END IF;
    IF _plan.status IN ('agreed', 'awaiting_payment', 'active', 'completed') THEN
      RAISE EXCEPTION 'plan_not_open';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_join_requests
    WHERE plan_id = p_plan_id
      AND requester_id = _requester_id
      AND status IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'request_already_exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.escrow_transactions
    WHERE plan_id = p_plan_id AND guest_id = _requester_id
  ) THEN
    RAISE EXCEPTION 'guest_already_has_escrow';
  END IF;

  INSERT INTO public.plan_join_requests (plan_id, requester_id, message)
  VALUES (p_plan_id, _requester_id, nullif(trim(p_message), ''))
  RETURNING id INTO _request_id;

  SELECT display_name INTO _guest_name FROM public.profiles WHERE user_id = _requester_id;

  PERFORM public.create_notification(
    _plan.creator_id,
    'join_request_received',
    'New join request',
    format('%s wants to join your plan.', COALESCE(_guest_name, 'Someone')),
    jsonb_build_object(
      'href', '/plan/' || p_plan_id::text || '/requests',
      'planId', p_plan_id::text,
      'requestId', _request_id::text,
      'requesterName', _guest_name
    ),
    'medium',
    NULL
  );

  RETURN _request_id;
END;
$$;

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
        _slot_amount,
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
        _total,
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

REVOKE ALL ON FUNCTION public.resolve_join_request_slot_cents(public.plans) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_join_request_slot_cents(public.plans) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_join_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_join_request(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.host_respond_to_join_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_respond_to_join_request(UUID, TEXT) TO authenticated;

-- Initialize suggested share for new group split plans.
CREATE OR REPLACE FUNCTION public.trg_plan_init_group_suggested_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_group_split_dynamic_plan(NEW) AND NEW.current_suggested_share_cents IS NULL THEN
    UPDATE public.plans
    SET current_suggested_share_cents = public.calculate_group_suggested_share(NEW.id)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_init_group_suggested_share ON public.plans;
CREATE TRIGGER plan_init_group_suggested_share
  AFTER INSERT ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_plan_init_group_suggested_share();

-- publish_plan: persist is_negotiable from payload (default true; forced true for pattern A).
CREATE OR REPLACE FUNCTION public.publish_plan(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  user_tier text;
  tier_rank SMALLINT;
  mood_reach_val text;
  is_mood boolean;
  is_group boolean;
  is_weekend boolean;
  v_is_paid boolean;
  v_escrow_pattern text;
  v_starting_cents integer;
  v_active_expires timestamptz;
  v_is_negotiable boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.user_may_create_plan(uid) THEN
    RAISE EXCEPTION 'Not allowed to publish plans' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(subscription_tier, 'FREE') INTO user_tier FROM public.users WHERE id = uid;

  tier_rank := CASE user_tier
    WHEN 'PLATINUM' THEN 3
    WHEN 'GOLD' THEN 2
    WHEN 'SILVER' THEN 1
    ELSE 0
  END;

  v_is_paid := CASE WHEN payload ? 'is_paid' THEN coalesce((payload->>'is_paid')::boolean, true) ELSE true END;
  v_escrow_pattern := nullif(trim(payload #>> '{escrow_pattern}'), '');
  v_starting_cents := nullif(payload #>> '{starting_price_cents}', '')::integer;

  v_is_negotiable := CASE
    WHEN v_escrow_pattern IN ('B', 'C') AND payload ? 'is_negotiable'
      THEN coalesce((payload->>'is_negotiable')::boolean, true)
    ELSE true
  END;

  IF v_is_paid AND v_escrow_pattern = 'B' AND user_tier NOT IN ('SILVER', 'GOLD', 'PLATINUM') THEN
    RAISE EXCEPTION 'escrow_pattern_b_requires_silver'
      USING HINT = 'Upgrade to Silver or above to use split escrow';
  END IF;

  IF v_is_paid AND v_escrow_pattern = 'C' AND user_tier NOT IN ('GOLD', 'PLATINUM') THEN
    RAISE EXCEPTION 'escrow_pattern_c_requires_gold'
      USING HINT = 'Upgrade to Gold or above to use guest-funded escrow';
  END IF;

  IF v_is_paid AND COALESCE(v_starting_cents, 0) > 500000000 THEN
    IF user_tier IS DISTINCT FROM 'PLATINUM' THEN
      RAISE EXCEPTION 'High-value escrow requires Platinum subscription';
    END IF;
  END IF;

  is_mood := CASE
    WHEN payload ? 'is_mood_plan' THEN coalesce((payload->>'is_mood_plan')::boolean, false)
    ELSE false
  END;

  is_group := CASE
    WHEN payload ? 'is_group_plan' THEN coalesce((payload->>'is_group_plan')::boolean, false)
    ELSE false
  END;

  IF is_mood THEN
    mood_reach_val := CASE user_tier
      WHEN 'PLATINUM' THEN 'all_cities'
      WHEN 'GOLD' THEN 'city_widest'
      WHEN 'SILVER' THEN 'city_adjacent'
      ELSE 'city'
    END;
    v_active_expires := NULL;
  ELSE
    mood_reach_val := NULL;
    v_active_expires := CASE user_tier
      WHEN 'PLATINUM' THEN now() + INTERVAL '30 days'
      WHEN 'GOLD' THEN now() + INTERVAL '14 days'
      WHEN 'SILVER' THEN now() + INTERVAL '14 days'
      ELSE now() + INTERVAL '7 days'
    END;
  END IF;

  is_weekend := is_mood
    AND user_tier IN ('GOLD', 'PLATINUM')
    AND EXTRACT(DOW FROM now()) = 5;

  INSERT INTO public.plans (
    creator_id,
    meet_type_id,
    title,
    description,
    starting_price_cents,
    currency,
    status,
    visibility,
    scheduled_at,
    location_label,
    latitude,
    longitude,
    is_paid,
    budget_min_cents,
    budget_max_cents,
    budget_tier,
    escrow_pattern,
    host_contribution_bps,
    is_negotiable,
    is_mood_plan,
    mood_expires_at,
    duration_minutes,
    mood_type,
    mood_start_time,
    mood_end_time,
    auto_expiry_at,
    urgency_level,
    negotiation_expires_at,
    spotlight_enabled,
    boosted_until,
    is_group_plan,
    max_free_guests,
    max_premium_guests,
    max_guests,
    multi_city,
    city_ids,
    mood_reach,
    is_weekend_plan,
    host_tier,
    host_tier_rank,
    extension_count,
    active_expires_at
  )
  VALUES (
    uid,
    (nullif(trim(payload #>> '{meet_type_id}'), ''))::uuid,
    trim(payload #>> '{title}'),
    nullif(trim(payload #>> '{description}'), ''),
    v_starting_cents,
    coalesce(nullif(trim(payload #>> '{currency}'), ''), 'NGN'),
    coalesce(nullif(trim(payload #>> '{status}'), ''), 'negotiating')::public.plan_status,
    coalesce(nullif(trim(payload #>> '{visibility}'), ''), 'public'),
    nullif(trim(payload #>> '{scheduled_at}'), '')::timestamptz,
    nullif(trim(payload #>> '{location_label}'), ''),
    nullif(payload #>> '{latitude}', '')::double precision,
    nullif(payload #>> '{longitude}', '')::double precision,
    v_is_paid,
    nullif(payload #>> '{budget_min_cents}', '')::integer,
    nullif(payload #>> '{budget_max_cents}', '')::integer,
    nullif(trim(payload #>> '{budget_tier}'), ''),
    v_escrow_pattern,
    nullif(payload #>> '{host_contribution_bps}', '')::integer,
    v_is_negotiable,
    is_mood,
    nullif(trim(payload #>> '{mood_expires_at}'), '')::timestamptz,
    nullif(payload #>> '{duration_minutes}', '')::integer,
    nullif(trim(payload #>> '{mood_type}'), ''),
    nullif(trim(payload #>> '{mood_start_time}'), '')::timestamptz,
    nullif(trim(payload #>> '{mood_end_time}'), '')::timestamptz,
    nullif(trim(payload #>> '{auto_expiry_at}'), '')::timestamptz,
    nullif(trim(payload #>> '{urgency_level}'), ''),
    nullif(trim(payload #>> '{negotiation_expires_at}'), '')::timestamptz,
    CASE WHEN payload ? 'spotlight_enabled' THEN coalesce((payload->>'spotlight_enabled')::boolean, false) ELSE false END,
    nullif(trim(payload #>> '{boosted_until}'), '')::timestamptz,
    is_group,
    nullif(payload #>> '{max_free_guests}', '')::integer,
    nullif(payload #>> '{max_premium_guests}', '')::integer,
    nullif(payload #>> '{max_guests}', '')::integer,
    CASE WHEN payload ? 'multi_city' THEN coalesce((payload->>'multi_city')::boolean, false) ELSE false END,
    CASE
      WHEN payload ? 'city_ids' AND jsonb_typeof(payload->'city_ids') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'city_ids'))
      ELSE NULL
    END,
    mood_reach_val,
    is_weekend,
    user_tier,
    tier_rank,
    0,
    v_active_expires
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
