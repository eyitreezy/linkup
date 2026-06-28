-- Tier-relative audience for visibility='premium' (4th option).
-- Depends on earth_distance_km() + plans.latitude/longitude (meetup coords) from migration 16.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS boost_radius_km INT DEFAULT 50;

COMMENT ON COLUMN public.plans.boost_radius_km IS
  'Radius (km) for Gold-creator premium-visibility boost expansion to Platinum viewers.';

-- ---------------------------------------------------------------------------
-- Tier-relative premium visibility gate (creator tier vs viewer tier at read time)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_premium_visibility_allows_viewer(
  p_creator_id uuid,
  p_boosted_until timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_boost_radius_km int
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_tier text;
  _viewer_tier text;
  _creator_rank int;
  _viewer_rank int;
  _is_boosted boolean;
  _viewer_within_boost_radius boolean := false;
BEGIN
  IF p_creator_id = auth.uid() THEN
    RETURN true;
  END IF;

  _creator_tier := COALESCE(public.resolve_user_display_tier(p_creator_id), 'FREE');
  _viewer_tier := COALESCE(public.resolve_user_display_tier(auth.uid()), 'FREE');

  _creator_rank := CASE _creator_tier
    WHEN 'PLATINUM' THEN 3 WHEN 'GOLD' THEN 2 WHEN 'SILVER' THEN 1 ELSE 0 END;
  _viewer_rank := CASE _viewer_tier
    WHEN 'PLATINUM' THEN 3 WHEN 'GOLD' THEN 2 WHEN 'SILVER' THEN 1 ELSE 0 END;

  _is_boosted := p_boosted_until IS NOT NULL AND p_boosted_until > NOW();

  -- FREE creator: paid viewers only (excludes Free)
  IF _creator_rank = 0 THEN
    RETURN _viewer_rank >= 1;
  END IF;

  -- SILVER creator: Free + Silver only — no boost expansion
  IF _creator_rank = 1 THEN
    RETURN _viewer_rank <= 1;
  END IF;

  -- GOLD creator: Free/Silver/Gold; boosted + within radius → Platinum
  IF _creator_rank = 2 THEN
    IF _viewer_rank <= 2 THEN
      RETURN true;
    END IF;
    IF _is_boosted AND _viewer_rank = 3 THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.profiles pr
        WHERE pr.user_id = auth.uid()
          AND pr.latitude IS NOT NULL
          AND pr.longitude IS NOT NULL
          AND p_latitude IS NOT NULL
          AND p_longitude IS NOT NULL
          AND public.earth_distance_km(pr.latitude, pr.longitude, p_latitude, p_longitude)
              <= COALESCE(p_boost_radius_km, 50)
      ) INTO _viewer_within_boost_radius;
      RETURN _viewer_within_boost_radius;
    END IF;
    RETURN false;
  END IF;

  -- PLATINUM creator: everyone
  IF _creator_rank = 3 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.plan_premium_visibility_allows_viewer(uuid, timestamptz, double precision, double precision, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_premium_visibility_allows_viewer(uuid, timestamptz, double precision, double precision, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: replace fixed Gold/Platinum premium branch with tier-relative logic
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
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT
    pl.creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      pl.visibility = 'public'
      AND COALESCE(pl.is_suppressed, false) = false
    )
    OR (
      pl.visibility = 'radius'
      AND COALESCE(pl.is_suppressed, false) = false
      AND pl.latitude IS NOT NULL
      AND pl.longitude IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles pr
        WHERE pr.user_id = auth.uid()
          AND pr.latitude IS NOT NULL
          AND pr.longitude IS NOT NULL
          AND public.earth_distance_km(pr.latitude, pr.longitude, pl.latitude, pl.longitude) <= 50
      )
    )
    OR (
      pl.visibility = 'premium'
      AND COALESCE(pl.is_suppressed, false) = false
      AND public.plan_premium_visibility_allows_viewer(
        pl.creator_id,
        pl.boosted_until,
        pl.latitude,
        pl.longitude,
        pl.boost_radius_km
      )
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

REVOKE ALL ON FUNCTION public.auth_uid_can_see_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_see_plan(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.plan_premium_visibility_allows_viewer(uuid, timestamptz, double precision, double precision, int) IS
  'Tier-relative audience for visibility=premium — evaluated at query time from creator and viewer effective tiers.';
