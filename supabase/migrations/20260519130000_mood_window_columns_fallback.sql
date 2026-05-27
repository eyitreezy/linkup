/**
 * mood_start_time / mood_end_time / auto_expiry_at
 *
 * Client publish normally sends them (details.tsx + publish_plan). Rows can still have NULLs when:
 * - Older app builds omitted bounds, or payloads stripped fields
 * - Direct SQL / partial RPC payloads
 *
 * trg_plans_financial_guard already sets auto_expiry_at := mood_expires_at for mood rows; this
 * migration adds sensible defaults for the social window when scheduled_at exists, backfills
 * existing mood plans, and keeps Discover/urgency helpers from reading NULLs.
 */

-- ---------------------------------------------------------------------------
-- One-time backfill (includes plans like e5f46e49-bb61-4ec0-8ce5-4efb9ab8be9e if they match)
-- ---------------------------------------------------------------------------
UPDATE public.plans p
SET
  mood_end_time = COALESCE(p.mood_end_time, p.scheduled_at, p.mood_expires_at),
  mood_start_time = COALESCE(
    p.mood_start_time,
    COALESCE(p.scheduled_at, p.mood_expires_at) - interval '4 hours'
  ),
  auto_expiry_at = COALESCE(p.auto_expiry_at, p.mood_expires_at),
  updated_at = now()
WHERE p.is_mood_plan = true
  AND p.mood_expires_at IS NOT NULL
  AND (
    p.mood_start_time IS NULL
    OR p.mood_end_time IS NULL
    OR p.auto_expiry_at IS NULL
  );

-- Clamp inverted windows (after COALESCE)
UPDATE public.plans p
SET
  mood_start_time = p.mood_end_time - interval '1 hour',
  updated_at = now()
WHERE p.is_mood_plan = true
  AND p.mood_start_time IS NOT NULL
  AND p.mood_end_time IS NOT NULL
  AND p.mood_start_time >= p.mood_end_time;

-- ---------------------------------------------------------------------------
-- Trigger: same defaults on every INSERT/UPDATE
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
