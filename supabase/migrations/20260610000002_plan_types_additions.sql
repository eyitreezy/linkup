/**
 * Plan types feature: group plans, mood reach, host tier sorting, premium visibility, publish RPC updates.
 */

-- ---------------------------------------------------------------------------
-- Schema additions (IF NOT EXISTS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_group_plan BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_free_guests INT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_premium_guests INT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_guests INT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS multi_city BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS city_ids TEXT[];

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_reach TEXT
  CHECK (mood_reach IS NULL OR mood_reach IN ('city', 'city_adjacent', 'city_widest', 'all_cities'));
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS extension_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_weekend_plan BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS host_tier TEXT DEFAULT 'FREE';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS host_tier_rank SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_until TIMESTAMPTZ;

-- visibility: allow premium (Gold & Platinum viewers — enforced in auth_uid_can_see_plan)
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_visibility_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_visibility_check
  CHECK (visibility IN ('public', 'radius', 'friends', 'premium'));

-- ---------------------------------------------------------------------------
-- Backfill host tier on existing plans
-- ---------------------------------------------------------------------------
UPDATE public.plans p
SET
  host_tier = COALESCE(u.subscription_tier, 'FREE'),
  host_tier_rank = CASE COALESCE(u.subscription_tier, 'FREE')
    WHEN 'PLATINUM' THEN 3
    WHEN 'GOLD' THEN 2
    WHEN 'SILVER' THEN 1
    ELSE 0
  END
FROM public.users u
WHERE u.id = p.creator_id
  AND (p.host_tier IS NULL OR p.host_tier = 'FREE' OR p.host_tier_rank = 0);

-- ---------------------------------------------------------------------------
-- Sync host_tier when subscription_tier changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_plan_host_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  rank_val SMALLINT;
BEGIN
  rank_val := CASE COALESCE(NEW.subscription_tier, 'FREE')
    WHEN 'PLATINUM' THEN 3
    WHEN 'GOLD' THEN 2
    WHEN 'SILVER' THEN 1
    ELSE 0
  END;

  UPDATE public.plans
  SET
    host_tier = COALESCE(NEW.subscription_tier, 'FREE'),
    host_tier_rank = rank_val
  WHERE creator_id = NEW.id
    AND status NOT IN ('completed', 'cancelled');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_host_tier ON public.users;
CREATE TRIGGER trg_sync_plan_host_tier
  AFTER UPDATE OF subscription_tier ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_host_tier();

-- ---------------------------------------------------------------------------
-- Group meet type seed
-- ---------------------------------------------------------------------------
INSERT INTO public.meet_types (
  name, slug, default_duration_minutes, allows_escrow,
  allowed_patterns, default_pattern, is_restricted, supports_mood, icon, sort_order, is_active
)
VALUES (
  'Group', 'group', 120, true,
  ARRAY['A', 'B', 'C']::TEXT[], 'A', false, false, 'people-outline', 50, true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  default_duration_minutes = EXCLUDED.default_duration_minutes,
  allows_escrow = EXCLUDED.allows_escrow,
  allowed_patterns = EXCLUDED.allowed_patterns,
  default_pattern = EXCLUDED.default_pattern,
  supports_mood = EXCLUDED.supports_mood,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- RLS: premium visibility (Gold & Platinum viewers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_uid_can_see_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ok boolean;
  viewer_tier text;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT COALESCE(u.subscription_tier, 'FREE') INTO viewer_tier
  FROM public.users u
  WHERE u.id = auth.uid();

  SELECT
    pl.creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      pl.visibility IN ('public', 'radius')
      AND COALESCE(pl.is_suppressed, false) = false
    )
    OR (
      pl.visibility = 'premium'
      AND COALESCE(pl.is_suppressed, false) = false
      AND viewer_tier IN ('GOLD', 'PLATINUM')
    )
    OR (
      pl.visibility = 'friends'
      AND COALESCE(pl.is_suppressed, false) = false
      AND pl.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.plan_offers o
      WHERE o.plan_id = pl.id
        AND o.bidder_id = auth.uid()
    )
  INTO ok
  FROM public.plans pl
  WHERE pl.id = p_plan_id;

  RETURN COALESCE(ok, false);
END;
$$;

-- ---------------------------------------------------------------------------
-- Boost / spotlight quota consumption (authenticated user, own row)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_boost_usage(p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  my_tier text;
  month_y text;
  col text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_kind NOT IN ('boosts_24hr', 'boosts_72hr', 'spotlights') THEN
    RAISE EXCEPTION 'Invalid kind' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(subscription_tier, 'FREE') INTO my_tier FROM public.users WHERE id = uid;

  IF my_tier = 'PLATINUM' THEN
    RETURN;
  END IF;

  month_y := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');

  INSERT INTO public.boost_quota (user_id, month_year)
  VALUES (uid, month_y)
  ON CONFLICT (user_id, month_year) DO NOTHING;

  col := p_kind || '_used';

  EXECUTE format(
    'UPDATE public.boost_quota SET %I = %I + 1, updated_at = now() WHERE user_id = $1 AND month_year = $2',
    col,
    col
  ) USING uid, month_y;
END;
$$;

REVOKE ALL ON FUNCTION public.record_boost_usage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_boost_usage(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- publish_plan — mood_reach, group fields, host_tier, is_weekend_plan
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
    nullif(payload #>> '{starting_price_cents}', '')::integer,
    coalesce(nullif(trim(payload #>> '{currency}'), ''), 'NGN'),
    coalesce(nullif(trim(payload #>> '{status}'), ''), 'negotiating')::public.plan_status,
    coalesce(nullif(trim(payload #>> '{visibility}'), ''), 'public'),
    nullif(trim(payload #>> '{scheduled_at}'), '')::timestamptz,
    nullif(trim(payload #>> '{location_label}'), ''),
    nullif(payload #>> '{latitude}', '')::double precision,
    nullif(payload #>> '{longitude}', '')::double precision,
    CASE WHEN payload ? 'is_paid' THEN coalesce((payload->>'is_paid')::boolean, true) ELSE true END,
    nullif(payload #>> '{budget_min_cents}', '')::integer,
    nullif(payload #>> '{budget_max_cents}', '')::integer,
    nullif(trim(payload #>> '{budget_tier}'), ''),
    nullif(trim(payload #>> '{escrow_pattern}'), ''),
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

NOTIFY pgrst, 'reload schema';
