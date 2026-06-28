-- Location / distance refactor: radius visibility gate, earth_distance helper
-- Audit outcome (A): plans.latitude / plans.longitude already store meetup coordinates.
-- No new coordinate columns or publish_plan changes required.

-- ---------------------------------------------------------------------------
-- Haversine distance (km) for RLS eligibility checks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.earth_distance_km(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * acos(
    LEAST(
      1.0,
      GREATEST(
        -1.0,
        cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
        + sin(radians(lat1)) * sin(radians(lat2))
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.earth_distance_km(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.earth_distance_km(double precision, double precision, double precision, double precision) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: visibility='radius' — fixed 50km from plan meetup location (profile baseline)
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

REVOKE ALL ON FUNCTION public.auth_uid_can_see_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_see_plan(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.earth_distance_km(double precision, double precision, double precision, double precision) IS
  'Great-circle distance in km between two WGS84 points — used for radius visibility RLS.';
