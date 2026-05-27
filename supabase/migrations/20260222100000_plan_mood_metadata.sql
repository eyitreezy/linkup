/**
 * Optional mood / urgency metadata on plans — safe ADD COLUMN only.
 * Core mood behavior still uses is_mood_plan + mood_expires_at + trigger guard.
 */

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_type TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_start_time TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_end_time TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS auto_expiry_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS urgency_level TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS negotiation_expires_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS spotlight_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.plans.mood_type IS 'UX label e.g. chill, spontaneous — discover strip mapping';
COMMENT ON COLUMN public.plans.urgency_level IS 'Derived bucket: happening_now, ending_soon, tonight_only, last_spot';
COMMENT ON COLUMN public.plans.negotiation_expires_at IS 'Optional shorter offer window for mood plans';

CREATE INDEX IF NOT EXISTS idx_plans_negotiation_expires
  ON public.plans (negotiation_expires_at)
  WHERE negotiation_expires_at IS NOT NULL AND status = 'negotiating';
