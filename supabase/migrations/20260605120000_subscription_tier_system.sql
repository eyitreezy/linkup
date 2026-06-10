/**
 * Phase 1 — Subscription tier system (FREE / SILVER / GOLD / PLATINUM).
 * Separate from KYC tier (trust) and legacy Paystack premium_until.
 */

-- ---------------------------------------------------------------------------
-- users: subscription + trial columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('FREE', 'SILVER', 'GOLD', 'PLATINUM'));

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_billing_cycle_check;
ALTER TABLE public.users ADD CONSTRAINT users_billing_cycle_check
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual'));

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flutterwave_customer_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flutterwave_subscription_code TEXT;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS silver_trial_activated_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS silver_trial_expires_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gold_trial_activated_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gold_trial_expires_at TIMESTAMPTZ;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_been_silver_subscriber BOOLEAN NOT NULL DEFAULT FALSE;

-- Extend kyc_tier: 0 = none, 1 = Tier 1, 2/3 reserved for future phases
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kyc_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_kyc_tier_check CHECK (kyc_tier IN (0, 1, 2, 3));
ALTER TABLE public.users ALTER COLUMN kyc_tier SET DEFAULT 0;

UPDATE public.users
SET kyc_tier = 0
WHERE verification_status IS DISTINCT FROM 'verified'::public.user_verification_status
  AND kyc_tier = 1;

UPDATE public.users
SET kyc_tier = 1
WHERE verification_status = 'verified'::public.user_verification_status
  AND kyc_tier = 0;

-- ---------------------------------------------------------------------------
-- subscription_events (append-only audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trial_started',
    'trial_expired',
    'subscription_created',
    'subscription_renewed',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'subscription_expired',
    'payment_failed',
    'payment_succeeded'
  )),
  from_tier TEXT CHECK (from_tier IS NULL OR from_tier IN ('FREE', 'SILVER', 'GOLD', 'PLATINUM')),
  to_tier TEXT CHECK (to_tier IS NULL OR to_tier IN ('FREE', 'SILVER', 'GOLD', 'PLATINUM')),
  billing_cycle TEXT CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual')),
  amount_ngn NUMERIC,
  flutterwave_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id
  ON public.subscription_events(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- boost_quota (monthly usage counters)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boost_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  boosts_24hr_used INT NOT NULL DEFAULT 0,
  boosts_72hr_used INT NOT NULL DEFAULT 0,
  spotlights_used INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_events_select_own ON public.subscription_events;
CREATE POLICY subscription_events_select_own ON public.subscription_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS subscription_events_insert_service ON public.subscription_events;
CREATE POLICY subscription_events_insert_service ON public.subscription_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.boost_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boost_quota_select_own ON public.boost_quota;
CREATE POLICY boost_quota_select_own ON public.boost_quota
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS boost_quota_service_all ON public.boost_quota;
CREATE POLICY boost_quota_service_all ON public.boost_quota
  FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Silver Explorer trial — auto on KYC Tier 1 approval
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_silver_explorer_trial(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u RECORD;
  trial_expiry TIMESTAMPTZ;
BEGIN
  SELECT
    subscription_tier,
    silver_trial_activated_at,
    subscription_expires_at
  INTO u
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF u.subscription_tier = 'FREE'
     AND u.silver_trial_activated_at IS NULL
     AND u.subscription_expires_at IS NULL THEN
    trial_expiry := NOW() + INTERVAL '7 days';
    UPDATE public.users
    SET
      silver_trial_activated_at = NOW(),
      silver_trial_expires_at = trial_expiry,
      updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO public.subscription_events (
      user_id, event_type, from_tier, to_tier, metadata
    ) VALUES (
      p_user_id,
      'trial_started',
      'FREE',
      'SILVER',
      jsonb_build_object('trial_type', 'silver_7_day', 'auto_triggered', true)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_verification_request_apply_user_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN (
    'admin_approved'::public.verification_request_status,
    'ai_pass'::public.verification_request_status
  ) THEN
    UPDATE public.users
    SET
      verification_status = 'verified'::public.user_verification_status,
      kyc_tier = GREATEST(kyc_tier, 1),
      updated_at = NOW()
    WHERE id = NEW.user_id;

    PERFORM public.activate_silver_explorer_trial(NEW.user_id);
  ELSIF NEW.status = 'admin_rejected'::public.verification_request_status THEN
    UPDATE public.users
    SET verification_status = 'rejected'::public.user_verification_status
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public tier badge on profiles (RLS-safe display on member profiles / feed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_badge TEXT;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_badge_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_badge_check
  CHECK (subscription_badge IS NULL OR subscription_badge IN ('SILVER', 'GOLD', 'PLATINUM'));

CREATE OR REPLACE FUNCTION public.resolve_user_display_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u RECORD;
BEGIN
  SELECT
    subscription_tier,
    subscription_expires_at,
    silver_trial_expires_at,
    gold_trial_expires_at,
    has_been_silver_subscriber
  INTO u
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF u.subscription_tier <> 'FREE'
     AND u.subscription_expires_at IS NOT NULL
     AND u.subscription_expires_at > NOW() THEN
    RETURN u.subscription_tier;
  END IF;

  IF u.silver_trial_expires_at IS NOT NULL
     AND u.silver_trial_expires_at > NOW()
     AND u.subscription_tier = 'FREE' THEN
    RETURN 'SILVER';
  END IF;

  IF u.gold_trial_expires_at IS NOT NULL
     AND u.gold_trial_expires_at > NOW()
     AND u.has_been_silver_subscriber THEN
    RETURN 'GOLD';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_profile_subscription_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge TEXT;
BEGIN
  badge := public.resolve_user_display_tier(NEW.id);
  UPDATE public.profiles
  SET subscription_badge = badge
  WHERE user_id = NEW.id
    AND subscription_badge IS DISTINCT FROM badge;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_users_sync_subscription_badge ON public.users;
CREATE TRIGGER tr_users_sync_subscription_badge
  AFTER UPDATE OF
    subscription_tier,
    subscription_expires_at,
    silver_trial_activated_at,
    silver_trial_expires_at,
    gold_trial_activated_at,
    gold_trial_expires_at,
    has_been_silver_subscriber
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_profile_subscription_badge();

UPDATE public.profiles p
SET subscription_badge = public.resolve_user_display_tier(p.user_id)
WHERE subscription_badge IS DISTINCT FROM public.resolve_user_display_tier(p.user_id);
