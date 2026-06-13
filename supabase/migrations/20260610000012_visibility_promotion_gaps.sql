-- Visibility & promotion gaps: plan active window, masked activity, publish_plan stamp

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS active_expires_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS masked_activity_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.plans.active_expires_at IS
  'Standard (non-mood) negotiating plans: auto-expire from Discover after tier-based window.';
COMMENT ON COLUMN public.profiles.masked_activity_enabled IS
  'Platinum: hide presence and engagement surfaces from public feeds.';

-- ---------------------------------------------------------------------------
-- sweep_expired_standard_plans — negotiating standard plans past active window
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_standard_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.plans p
  SET
    is_expired = true,
    updated_at = now()
  WHERE p.is_mood_plan = false
    AND p.active_expires_at IS NOT NULL
    AND p.active_expires_at < now()
    AND COALESCE(p.is_expired, false) = false
    AND p.status = 'negotiating'::public.plan_status;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_expired_standard_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_expired_standard_plans() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_expired_standard_plans() TO postgres;

-- ---------------------------------------------------------------------------
-- publish_plan — stamp active_expires_at for standard plans
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
  v_active_expires timestamptz;
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
