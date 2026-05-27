/**
 * Dynamic meet types (no enum), plan financials + mood, extended escrow (pattern-aware).
 * Host = plans.creator_id (existing column).
 */

-- ---------------------------------------------------------------------------
-- meet_types (catalog; editable without migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meet_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  default_duration_minutes INTEGER NOT NULL DEFAULT 120,
  allows_escrow BOOLEAN NOT NULL DEFAULT true,
  allowed_patterns TEXT[] NOT NULL DEFAULT ARRAY['A']::TEXT[],
  default_pattern TEXT CHECK (default_pattern IS NULL OR default_pattern IN ('A', 'B', 'C')),
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  supports_mood BOOLEAN NOT NULL DEFAULT false,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meet_types_patterns_subset CHECK (allowed_patterns <@ ARRAY['A', 'B', 'C']::TEXT[])
);

CREATE INDEX IF NOT EXISTS idx_meet_types_active_sort ON public.meet_types (is_active, sort_order);

ALTER TABLE public.meet_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meet_types_select ON public.meet_types;
CREATE POLICY meet_types_select ON public.meet_types
  FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

-- No client writes (admin/seed only via service role or superuser)

INSERT INTO public.meet_types (name, slug, default_duration_minutes, allows_escrow, allowed_patterns, default_pattern, is_restricted, supports_mood, icon, sort_order)
VALUES
  ('Dinner', 'dinner', 180, true, ARRAY['A', 'B']::TEXT[], 'A', false, false, 'restaurant-outline', 10),
  ('Casual', 'casual', 90, true, ARRAY['A', 'B']::TEXT[], 'A', false, false, 'cafe-outline', 20),
  ('Gym', 'gym', 60, true, ARRAY['A', 'B']::TEXT[], 'B', false, false, 'barbell-outline', 30),
  ('Hangout', 'hangout', 120, true, ARRAY['A', 'B']::TEXT[], 'A', false, false, 'people-outline', 40),
  ('Mood', 'mood', 240, true, ARRAY['A', 'C']::TEXT[], 'A', true, true, 'flash-outline', 5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  default_duration_minutes = EXCLUDED.default_duration_minutes,
  allows_escrow = EXCLUDED.allows_escrow,
  allowed_patterns = EXCLUDED.allowed_patterns,
  default_pattern = EXCLUDED.default_pattern,
  is_restricted = EXCLUDED.is_restricted,
  supports_mood = EXCLUDED.supports_mood,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- users: KYC tier (1 = standard, 2 = enhanced e.g. BVN — app enforces Pattern C)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_tier SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kyc_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_kyc_tier_check CHECK (kyc_tier IN (1, 2));

-- ---------------------------------------------------------------------------
-- plans: financial + mood + meet type
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS meet_type_id UUID REFERENCES public.meet_types (id) ON DELETE SET NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS budget_min_cents INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS budget_max_cents INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS budget_tier TEXT CHECK (budget_tier IS NULL OR budget_tier IN ('low', 'mid', 'high'));
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS escrow_pattern TEXT CHECK (escrow_pattern IS NULL OR escrow_pattern IN ('A', 'B', 'C'));
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS host_contribution_bps INTEGER CHECK (host_contribution_bps IS NULL OR (host_contribution_bps >= 0 AND host_contribution_bps <= 10000));
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_mood_plan BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mood_expires_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_plans_meet_type ON public.plans (meet_type_id);
CREATE INDEX IF NOT EXISTS idx_plans_mood_live ON public.plans (is_mood_plan, mood_expires_at) WHERE is_mood_plan = true AND mood_expires_at IS NOT NULL;

-- Backfill meet_type + flags for existing rows
UPDATE public.plans p
SET meet_type_id = (SELECT id FROM public.meet_types WHERE slug = 'dinner' LIMIT 1)
WHERE p.meet_type_id IS NULL;

UPDATE public.plans
SET
  is_paid = COALESCE(starting_price_cents, 0) > 0 OR agreed_price_cents IS NOT NULL,
  escrow_pattern = CASE
    WHEN COALESCE(starting_price_cents, 0) > 0 OR agreed_price_cents IS NOT NULL THEN 'A'
    ELSE NULL
  END
WHERE escrow_pattern IS NULL;

UPDATE public.plans
SET is_paid = false, escrow_pattern = NULL
WHERE COALESCE(starting_price_cents, 0) = 0 AND agreed_price_cents IS NULL;

-- ---------------------------------------------------------------------------
-- plan_offers: optional location text (negotiation)
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS proposed_location TEXT;

-- ---------------------------------------------------------------------------
-- escrow_transactions: host/guest, pattern, shares, deadlines, partial B funding
-- ---------------------------------------------------------------------------
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS escrow_pattern TEXT CHECK (escrow_pattern IS NULL OR escrow_pattern IN ('A', 'B', 'C'));
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS host_share_cents INTEGER;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS guest_share_cents INTEGER;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS funding_deadline TIMESTAMPTZ;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS host_funded_at TIMESTAMPTZ;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS guest_funded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.escrow_transactions.host_share_cents IS 'Pattern A/B/C: host-side share in kobo; Pattern A typically equals total amount.';
COMMENT ON COLUMN public.escrow_transactions.guest_share_cents IS 'Guest-side share; Pattern B uses both; Pattern C guest pays full amount.';

-- ---------------------------------------------------------------------------
-- escrow_status: active (funded, meet in progress — optional UX/state)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.escrow_status ADD VALUE 'active';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Validation trigger: plan financials vs meet type + mood
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_plans_financial_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
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
  ELSE
    NEW.mood_expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_plans_financial_guard ON public.plans;
CREATE TRIGGER tr_plans_financial_guard
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_plans_financial_guard();

-- ---------------------------------------------------------------------------
-- Realtime: plans + escrow (optional — uncomment in Dashboard if needed)
-- ---------------------------------------------------------------------------
-- alter publication supabase_realtime add table public.plans;
-- alter publication supabase_realtime add table public.escrow_transactions;
