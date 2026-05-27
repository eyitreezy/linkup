/**
 * Idempotent backfill for `public.plans` columns used by the mobile client when publishing
 * (see `app/plan/create/details.tsx` insert payload).
 *
 * Apply with: `supabase db push` / `supabase migration up`, or run this file in the SQL Editor
 * if a remote project skipped earlier migrations (PostgREST error: column not in schema cache).
 *
 * Requires `public.meet_types` to exist for the meet_type_id FK (added in 20260215100000).
 */

-- Financial + meet type + mood core (20260215100000_meet_types_plans_escrow_v2.sql)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS meet_type_id UUID REFERENCES public.meet_types (id) ON DELETE SET NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS budget_min_cents INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS budget_max_cents INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS budget_tier TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS escrow_pattern TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS host_contribution_bps INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_mood_plan BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_expires_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Optional CHECK constraints (skip if columns already exist with different checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_budget_tier_check'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_budget_tier_check
      CHECK (budget_tier IS NULL OR budget_tier IN ('low', 'mid', 'high'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_escrow_pattern_check'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_escrow_pattern_check
      CHECK (escrow_pattern IS NULL OR escrow_pattern IN ('A', 'B', 'C'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_host_contribution_bps_check'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_host_contribution_bps_check
      CHECK (host_contribution_bps IS NULL OR (host_contribution_bps >= 0 AND host_contribution_bps <= 10000));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plans_meet_type ON public.plans (meet_type_id);
CREATE INDEX IF NOT EXISTS idx_plans_mood_live ON public.plans (is_mood_plan, mood_expires_at) WHERE is_mood_plan = true AND mood_expires_at IS NOT NULL;

-- Mood metadata + spotlight (20260222100000_plan_mood_metadata.sql)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_type TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_start_time TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_end_time TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS auto_expiry_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS urgency_level TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS negotiation_expires_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS spotlight_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_plans_negotiation_expires
  ON public.plans (negotiation_expires_at)
  WHERE negotiation_expires_at IS NOT NULL AND status = 'negotiating';

-- Trust / feeds (20260216130000_plans_rls_recursion_helpers.sql)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.plans.auto_expiry_at IS 'Mood plan auto-expiry (mirrors mood_expires_at in client publish payload).';
COMMENT ON COLUMN public.plans.urgency_level IS 'Derived bucket for discover urgency.';
COMMENT ON COLUMN public.plans.negotiation_expires_at IS 'Optional shorter offer window for mood plans.';

-- Prompt PostgREST to refresh schema cache (Supabase / PostgREST)
NOTIFY pgrst, 'reload schema';
