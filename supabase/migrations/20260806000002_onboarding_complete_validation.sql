-- Enforce onboarding completion requirements server-side (profiles.onboarding_status = complete)

CREATE OR REPLACE FUNCTION public.validate_profile_onboarding_complete(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_prefs jsonb;
  v_photo_count int;
  v_has_video boolean;
  v_age_years int;
  v_filled_prompts int;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'onboarding_incomplete: Profile not found.';
  END IF;

  v_prefs := COALESCE(v_profile.preferences, '{}'::jsonb);
  v_photo_count := COALESCE(array_length(v_profile.photo_urls, 1), 0);

  IF v_photo_count < 3 THEN
    RAISE EXCEPTION 'onboarding_incomplete: You need at least 3 profile photos before completing onboarding.';
  END IF;

  IF v_profile.primary_photo_url IS NULL AND v_profile.avatar_url IS NULL THEN
    RAISE EXCEPTION 'onboarding_incomplete: Choose a primary profile photo before completing onboarding.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.media m
    WHERE m.parent_table = 'profiles'
      AND m.parent_id = p_user_id
      AND (
        COALESCE(m.metadata->>'kind', '') = 'profile_intro'
        OR COALESCE(m.mime_type, '') LIKE 'video/%'
      )
  ) INTO v_has_video;

  IF NOT v_has_video THEN
    RAISE EXCEPTION 'onboarding_incomplete: Add one intro video before completing onboarding.';
  END IF;

  IF COALESCE(trim(v_profile.display_name), '') = '' THEN
    RAISE EXCEPTION 'onboarding_incomplete: Add a display name before completing onboarding.';
  END IF;

  IF v_profile.birth_date IS NULL THEN
    RAISE EXCEPTION 'onboarding_incomplete: Add your birthday before completing onboarding.';
  END IF;

  v_age_years := date_part('year', age(v_profile.birth_date));
  IF v_age_years < 18 THEN
    RAISE EXCEPTION 'onboarding_incomplete: You must be 18 or older to use LinkUp.';
  END IF;

  IF COALESCE((v_prefs->>'adult_confirmed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'onboarding_incomplete: Confirm you are 18 or older before completing onboarding.';
  END IF;

  IF v_profile.latitude IS NULL OR v_profile.longitude IS NULL
     OR COALESCE(trim(v_profile.location_label), '') = '' THEN
    RAISE EXCEPTION 'onboarding_incomplete: Pick your location from search results before completing onboarding.';
  END IF;

  IF COALESCE(jsonb_array_length(v_prefs->'interests'), 0) < 1 THEN
    RAISE EXCEPTION 'onboarding_incomplete: Add at least one interest before completing onboarding.';
  END IF;

  IF COALESCE(jsonb_array_length(v_prefs->'languages'), 0) < 1 THEN
    RAISE EXCEPTION 'onboarding_incomplete: Add at least one language before completing onboarding.';
  END IF;

  IF COALESCE(trim(v_prefs->>'meeting_intent'), '') = '' THEN
    RAISE EXCEPTION 'onboarding_incomplete: Choose what you are here for before completing onboarding.';
  END IF;

  SELECT COUNT(*)::int INTO v_filled_prompts
  FROM jsonb_array_elements(COALESCE(v_prefs->'prompt_answers', '[]'::jsonb)) elem
  WHERE COALESCE(trim(elem->>'answer'), '') <> '';

  IF v_filled_prompts < 1 THEN
    RAISE EXCEPTION 'onboarding_incomplete: Answer at least one prompt before completing onboarding.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_profile_onboarding_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_profile_onboarding_complete(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_onboarding_complete_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_status = 'complete'
     AND (OLD.onboarding_status IS DISTINCT FROM 'complete') THEN
    PERFORM public.validate_profile_onboarding_complete(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_enforce_onboarding_complete ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_onboarding_complete
  BEFORE UPDATE OF onboarding_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_onboarding_complete_requirements();

-- Mobile discover route (web uses /discover)
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
