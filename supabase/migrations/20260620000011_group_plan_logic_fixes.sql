-- Group plan logic: guest count sync, discover eligibility, tier-relative visibility reaffirmed at query time.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS accepted_guest_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.plans.accepted_guest_count IS
  'Accepted guest slots filled on group plans — synced from plan_offers.status=accepted.';

-- Backfill from existing accepted offers
UPDATE public.plans p
SET accepted_guest_count = sub.cnt
FROM (
  SELECT plan_id, COUNT(*)::int AS cnt
  FROM public.plan_offers
  WHERE status = 'accepted'::public.offer_status
  GROUP BY plan_id
) sub
WHERE p.id = sub.plan_id
  AND p.is_group_plan = true
  AND p.accepted_guest_count IS DISTINCT FROM sub.cnt;

-- Keep accepted_guest_count in sync when offers are accepted / un-accepted
CREATE OR REPLACE FUNCTION public.sync_group_plan_accepted_guest_count(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt int;
BEGIN
  SELECT COUNT(*)::int
  INTO v_cnt
  FROM public.plan_offers o
  WHERE o.plan_id = p_plan_id
    AND o.status = 'accepted'::public.offer_status;

  UPDATE public.plans
  SET accepted_guest_count = v_cnt,
      updated_at = now()
  WHERE id = p_plan_id
    AND is_group_plan = true
    AND accepted_guest_count IS DISTINCT FROM v_cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_plan_offers_sync_group_guest_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND (
       NEW.status = 'accepted'::public.offer_status
       OR OLD.status = 'accepted'::public.offer_status
     ) THEN
    PERFORM public.sync_group_plan_accepted_guest_count(NEW.plan_id);
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'accepted'::public.offer_status THEN
    PERFORM public.sync_group_plan_accepted_guest_count(NEW.plan_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_offers_sync_group_guest_count ON public.plan_offers;
CREATE TRIGGER trg_plan_offers_sync_group_guest_count
  AFTER INSERT OR UPDATE OF status ON public.plan_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_plan_offers_sync_group_guest_count();

-- Discover feed helper: group plans stay open until max capacity
CREATE OR REPLACE FUNCTION public.plan_is_discover_open(p_plan public.plans)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF COALESCE(p_plan.is_suppressed, false) THEN
    RETURN false;
  END IF;
  IF p_plan.archived_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF p_plan.status NOT IN ('negotiating'::public.plan_status, 'active'::public.plan_status) THEN
    RETURN false;
  END IF;
  IF COALESCE(p_plan.is_group_plan, false) THEN
    RETURN COALESCE(p_plan.accepted_guest_count, 0) < COALESCE(p_plan.max_guests, 2147483647);
  END IF;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.plan_is_discover_open(public.plans) IS
  'Group plans remain discoverable until accepted_guest_count reaches max_guests.';

-- Reaffirm tier-relative premium visibility evaluates viewer tier at query time (not stamped on plan).
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

  IF _creator_rank = 0 THEN
    RETURN _viewer_rank >= 1;
  END IF;

  IF _creator_rank = 1 THEN
    RETURN _viewer_rank <= 1;
  END IF;

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

  IF _creator_rank = 3 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

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
      AND (
        pl.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.plan_offers o
          JOIN public.plans cp ON cp.id = o.plan_id
          WHERE o.bidder_id = auth.uid()
            AND cp.creator_id = pl.creator_id
            AND cp.status IN ('agreed', 'active', 'completed')
            AND o.status = 'accepted'::public.offer_status
        )
        OR EXISTS (
          SELECT 1
          FROM public.plans hp
          JOIN public.plan_offers ho ON ho.id = hp.accepted_offer_id
          WHERE hp.creator_id = auth.uid()
            AND ho.bidder_id = pl.creator_id
            AND hp.status IN ('agreed', 'active', 'completed')
        )
      )
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

REVOKE ALL ON FUNCTION public.sync_group_plan_accepted_guest_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_group_plan_accepted_guest_count(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
