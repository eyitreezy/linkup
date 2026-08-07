-- Mood plan reach update (city_widest 20km) + nearby mood publish notifications

CREATE OR REPLACE FUNCTION public.mood_reach_km(p_reach text)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_reach
    WHEN 'city' THEN 25::double precision
    WHEN 'city_adjacent' THEN 50::double precision
    WHEN 'city_widest' THEN 20::double precision
    WHEN 'all_cities' THEN NULL::double precision
    ELSE 25::double precision
  END;
$$;

REVOKE ALL ON FUNCTION public.mood_reach_km(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mood_reach_km(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_mood_plan_nearby_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reach_km double precision;
  v_title text;
  v_body text;
  v_rec record;
BEGIN
  IF NOT COALESCE(NEW.is_mood_plan, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  v_reach_km := public.mood_reach_km(NEW.mood_reach);
  v_title := COALESCE(NULLIF(trim(NEW.title), ''), 'Mood moment nearby');
  v_body := 'Someone nearby just posted a mood plan. Open Discover to see it.';

  FOR v_rec IN
    SELECT pr.user_id
    FROM public.profiles pr
    JOIN public.users u ON u.id = pr.user_id
    WHERE pr.user_id <> NEW.creator_id
      AND pr.latitude IS NOT NULL
      AND pr.longitude IS NOT NULL
      AND u.account_status = 'active'
      AND COALESCE((pr.preferences->'notifications'->>'push')::boolean, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks ub
        WHERE (ub.blocker_id = NEW.creator_id AND ub.blocked_id = pr.user_id)
           OR (ub.blocker_id = pr.user_id AND ub.blocked_id = NEW.creator_id)
      )
      AND (
        v_reach_km IS NULL
        OR public.earth_distance_km(pr.latitude, pr.longitude, NEW.latitude, NEW.longitude) <= v_reach_km
      )
  LOOP
    PERFORM public.create_notification(
      v_rec.user_id,
      'mood_plan_nearby',
      v_title,
      v_body,
      jsonb_build_object(
        'href', '/(tabs)',
        'planId', NEW.id::text,
        'type', 'mood_plan_nearby'
      ),
      'medium',
      'mood_plan:' || NEW.id::text || ':' || v_rec.user_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plans_notify_mood_nearby ON public.plans;
CREATE TRIGGER trg_plans_notify_mood_nearby
  AFTER INSERT ON public.plans
  FOR EACH ROW
  WHEN (NEW.is_mood_plan IS TRUE)
  EXECUTE FUNCTION public.notify_mood_plan_nearby_users();

COMMENT ON FUNCTION public.mood_reach_km(text) IS
  'Maps mood_reach enum to km radius. city_widest (GOLD) = 20km.';

COMMENT ON FUNCTION public.notify_mood_plan_nearby_users() IS
  'Notifies eligible users within mood reach when a mood plan is published. Deduped per user/plan.';
