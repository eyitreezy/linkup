-- Escrow server tier gates, high-value publish guard, release → wallet payout RPC

-- ---------------------------------------------------------------------------
-- Platform fee (mirrors lib/plans/planFinancialConfig.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_fee_cents_for_amount(p_amount_cents INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ngn NUMERIC;
  v_bps INT;
BEGIN
  IF COALESCE(p_amount_cents, 0) <= 0 THEN
    RETURN 0;
  END IF;
  v_ngn := p_amount_cents / 100.0;
  IF v_ngn < 50000 THEN
    v_bps := 700;
  ELSIF v_ngn < 500000 THEN
    v_bps := 600;
  ELSE
    v_bps := 500;
  END IF;
  RETURN ROUND((p_amount_cents * v_bps) / 10000.0)::INT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Internal: release escrow → payee wallet
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
  v_fee INT;
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

  v_fee := public.platform_fee_cents_for_amount(v_escrow.amount_cents);
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_fee);
  v_ref := v_escrow.id::text || CASE WHEN p_auto_released THEN ':auto' ELSE ':manual' END;

  IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
    PERFORM public._wallet_credit_internal(
      v_escrow.payee_id,
      v_net,
      'escrow_release',
      v_ref,
      jsonb_build_object(
        'plan_id', v_escrow.plan_id,
        'platform_fee_cents', v_fee,
        'escrow_pattern', v_escrow.escrow_pattern,
        'auto_released', p_auto_released
      )
    );
  END IF;

  UPDATE public.escrow_transactions
  SET
    status = 'released',
    released_at = now(),
    platform_fee_cents = v_fee,
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
    'platform_fee_cents', v_fee,
    'payee_id', v_escrow.payee_id,
    'auto_released', p_auto_released
  );
END;
$$;

REVOKE ALL ON FUNCTION public._escrow_release_internal(UUID, BOOLEAN) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.release_escrow_funds(p_escrow_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_escrow public.escrow_transactions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE id = p_escrow_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_not_found';
  END IF;

  IF NOT (
    public.is_admin(v_uid)
    OR v_escrow.payer_id = v_uid
    OR v_escrow.payee_id = v_uid
    OR v_escrow.host_id = v_uid
    OR v_escrow.guest_id = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN public._escrow_release_internal(p_escrow_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.release_escrow_funds(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_escrow_funds(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- publish_plan — tier gates for Pattern B/C + high-value Platinum
-- ---------------------------------------------------------------------------
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
  ELSE
    mood_reach_val := NULL;
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
    extension_count
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
    0
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- trg_plans_financial_guard — subscription tier + high-value on UPDATE/INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_plans_financial_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  mt public.meet_types%ROWTYPE;
  supports_mood_flag BOOLEAN;
  v_tier TEXT;
BEGIN
  IF NEW.meet_type_id IS NOT NULL THEN
    SELECT * INTO mt FROM public.meet_types WHERE id = NEW.meet_type_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'meet_type_id does not reference a valid meet type';
    END IF;
    IF NOT mt.allows_escrow AND NEW.is_paid THEN
      RAISE EXCEPTION 'This meet type does not allow paid escrow plans';
    END IF;
  END IF;

  IF NEW.is_paid IS NOT TRUE THEN
    NEW.escrow_pattern := NULL;
    NEW.host_contribution_bps := NULL;
  ELSE
    IF NEW.escrow_pattern IS NULL THEN
      RAISE EXCEPTION 'escrow_pattern is required when is_paid is true';
    END IF;
    IF NEW.meet_type_id IS NOT NULL THEN
      SELECT * INTO mt FROM public.meet_types WHERE id = NEW.meet_type_id;
      IF NOT (NEW.escrow_pattern = ANY (mt.allowed_patterns)) THEN
        RAISE EXCEPTION 'escrow_pattern % is not allowed for this meet type', NEW.escrow_pattern;
      END IF;
    END IF;
    IF NEW.escrow_pattern = 'B' AND NEW.host_contribution_bps IS NULL THEN
      NEW.host_contribution_bps := 5000;
    END IF;

    SELECT COALESCE(subscription_tier, 'FREE') INTO v_tier FROM public.users WHERE id = NEW.creator_id;
    IF NEW.escrow_pattern = 'B' AND v_tier NOT IN ('SILVER', 'GOLD', 'PLATINUM') THEN
      RAISE EXCEPTION 'Escrow pattern B requires Silver subscription or above';
    END IF;
    IF NEW.escrow_pattern = 'C' AND v_tier NOT IN ('GOLD', 'PLATINUM') THEN
      RAISE EXCEPTION 'Escrow pattern C requires Gold subscription or above';
    END IF;

    IF COALESCE(NEW.starting_price_cents, NEW.agreed_price_cents, 0) > 500000000 THEN
      IF v_tier IS DISTINCT FROM 'PLATINUM' THEN
        RAISE EXCEPTION 'High-value escrow requires Platinum subscription';
      END IF;
    END IF;
  END IF;

  IF NEW.is_mood_plan THEN
    IF NEW.meet_type_id IS NULL THEN
      RAISE EXCEPTION 'meet_type_id is required for mood plans';
    END IF;
    SELECT supports_mood INTO supports_mood_flag FROM public.meet_types WHERE id = NEW.meet_type_id;
    IF NOT COALESCE(supports_mood_flag, false) THEN
      RAISE EXCEPTION 'This meet type does not support mood plans';
    END IF;
    IF NEW.mood_expires_at IS NULL THEN
      RAISE EXCEPTION 'mood_expires_at is required for mood plans';
    END IF;

    NEW.auto_expiry_at := COALESCE(NEW.auto_expiry_at, NEW.mood_expires_at);

    IF NEW.mood_end_time IS NULL THEN
      NEW.mood_end_time := COALESCE(NEW.scheduled_at, NEW.mood_expires_at);
    END IF;

    IF NEW.mood_start_time IS NULL AND NEW.mood_end_time IS NOT NULL THEN
      NEW.mood_start_time := NEW.mood_end_time - interval '4 hours';
    END IF;

    IF NEW.mood_start_time IS NULL
      AND NEW.mood_end_time IS NULL
      AND NEW.mood_expires_at IS NOT NULL THEN
      NEW.mood_end_time := NEW.mood_expires_at;
      NEW.mood_start_time := NEW.mood_end_time - interval '4 hours';
    END IF;

    IF NEW.mood_start_time IS NOT NULL
      AND NEW.mood_end_time IS NOT NULL
      AND NEW.mood_start_time >= NEW.mood_end_time THEN
      NEW.mood_start_time := NEW.mood_end_time - interval '1 hour';
    END IF;
  ELSE
    NEW.mood_expires_at := NULL;
    NEW.auto_expiry_at := NULL;
    NEW.mood_type := NULL;
    NEW.mood_start_time := NULL;
    NEW.mood_end_time := NULL;
    NEW.urgency_level := NULL;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
