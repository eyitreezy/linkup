/**
 * `trg_plans_financial_guard` reads `meet_types` on every plans INSERT/UPDATE. Without
 * bypassing RLS, catalog rows (e.g. inactive) or evaluator role quirks block harmless
 * updates like `is_suppressed` — PostgREST surfaces this as meet_types RLS errors.
 */
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
    NEW.auto_expiry_at := NEW.mood_expires_at;
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
