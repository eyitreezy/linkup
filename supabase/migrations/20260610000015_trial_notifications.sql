-- Trial lifecycle notifications, tier resolution fix, contact hashes, admin trial controls, cron updates

-- ---------------------------------------------------------------------------
-- subscription_events — extend event_type CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_event_type_check
  CHECK (event_type IN (
    'trial_started',
    'trial_expired',
    'trial_expiring_notified',
    'subscription_created',
    'subscription_renewed',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'subscription_expired',
    'payment_failed',
    'payment_succeeded',
    'admin_trial_grant',
    'admin_trial_extend',
    'admin_trial_revoke'
  ));

-- ---------------------------------------------------------------------------
-- Silver Explorer trial — notify on start
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

    PERFORM public.create_notification(
      p_user_id,
      'trial_started',
      'Your 7-day Silver trial has started',
      'Enjoy Silver features free for 7 days — including saved plans, advanced filters, and more.',
      jsonb_build_object('href', '/subscription', 'trialType', 'silver')
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trial expiring soon (3 days) — daily sweep via Edge Function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_trial_expiring_soon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row RECORD;
BEGIN
  FOR _row IN
    SELECT id FROM public.users
    WHERE silver_trial_expires_at::date = (NOW() + INTERVAL '3 days')::date
      AND silver_trial_activated_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.subscription_events
        WHERE user_id = users.id
          AND event_type = 'trial_expiring_notified'
          AND metadata->>'trial_type' = 'silver_7_day'
      )
  LOOP
    PERFORM public.create_notification(
      _row.id,
      'trial_expiring',
      'Your Silver trial ends in 3 days',
      'Subscribe to keep your Silver features — or they''ll switch back to Free.',
      jsonb_build_object('href', '/subscription', 'trialType', 'silver')
    );
    INSERT INTO public.subscription_events (user_id, event_type, metadata)
    VALUES (_row.id, 'trial_expiring_notified', jsonb_build_object('trial_type', 'silver_7_day'));
  END LOOP;

  FOR _row IN
    SELECT id FROM public.users
    WHERE gold_trial_expires_at::date = (NOW() + INTERVAL '3 days')::date
      AND gold_trial_activated_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.subscription_events
        WHERE user_id = users.id
          AND event_type = 'trial_expiring_notified'
          AND metadata->>'trial_type' = 'gold_7_day'
      )
  LOOP
    PERFORM public.create_notification(
      _row.id,
      'trial_expiring',
      'Your Gold trial ends in 3 days',
      'Subscribe to keep your Gold features — or they''ll switch back.',
      jsonb_build_object('href', '/subscription', 'trialType', 'gold')
    );
    INSERT INTO public.subscription_events (user_id, event_type, metadata)
    VALUES (_row.id, 'trial_expiring_notified', jsonb_build_object('trial_type', 'gold_7_day'));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_trial_expiring_soon() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_trial_expiring_soon() TO service_role;

-- ---------------------------------------------------------------------------
-- Display tier — Gold trial before paid SILVER; legacy premium_until fallback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_user_display_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u RECORD;
  _paid_active BOOLEAN;
BEGIN
  SELECT
    subscription_tier,
    subscription_expires_at,
    silver_trial_expires_at,
    silver_trial_activated_at,
    gold_trial_expires_at,
    gold_trial_activated_at,
    has_been_silver_subscriber,
    premium_until
  INTO u
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  _paid_active := u.subscription_expires_at IS NOT NULL AND u.subscription_expires_at > NOW();

  IF _paid_active AND u.subscription_tier IN ('PLATINUM', 'GOLD') THEN
    RETURN u.subscription_tier;
  END IF;

  IF u.gold_trial_activated_at IS NOT NULL
     AND u.gold_trial_expires_at IS NOT NULL
     AND u.gold_trial_expires_at > NOW()
     AND u.has_been_silver_subscriber THEN
    RETURN 'GOLD';
  END IF;

  IF _paid_active AND u.subscription_tier = 'SILVER' THEN
    RETURN 'SILVER';
  END IF;

  IF u.subscription_tier = 'FREE'
     AND u.silver_trial_activated_at IS NOT NULL
     AND u.silver_trial_expires_at IS NOT NULL
     AND u.silver_trial_expires_at > NOW() THEN
    RETURN 'SILVER';
  END IF;

  -- Legacy Paystack premium maps to SILVER-equivalent benefits at resolution time only
  IF u.premium_until IS NOT NULL AND u.premium_until > NOW() THEN
    RETURN 'SILVER';
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- contact_hashes — privacy-safe contact matching (hashed values only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contact_hash)
);

ALTER TABLE public.contact_hashes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_contact_hashes ON public.contact_hashes;
CREATE POLICY users_manage_own_contact_hashes
  ON public.contact_hashes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contact_hashes_hash ON public.contact_hashes(contact_hash);

-- ---------------------------------------------------------------------------
-- Admin trial controls
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_trial(
  p_user_id UUID,
  p_trial_type TEXT,
  p_action TEXT,
  p_days INT DEFAULT 7,
  p_admin_id UUID DEFAULT auth.uid()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF p_trial_type NOT IN ('silver', 'gold') THEN
    RAISE EXCEPTION 'invalid_trial_type';
  END IF;

  IF p_action NOT IN ('grant', 'extend', 'revoke') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  IF p_trial_type = 'silver' THEN
    IF p_action = 'grant' THEN
      UPDATE public.users SET
        silver_trial_activated_at = NOW(),
        silver_trial_expires_at = NOW() + (p_days || ' days')::interval,
        updated_at = NOW()
      WHERE id = p_user_id;
    ELSIF p_action = 'extend' THEN
      UPDATE public.users SET
        silver_trial_expires_at = COALESCE(silver_trial_expires_at, NOW()) + (p_days || ' days')::interval,
        updated_at = NOW()
      WHERE id = p_user_id;
    ELSIF p_action = 'revoke' THEN
      UPDATE public.users SET silver_trial_expires_at = NOW(), updated_at = NOW() WHERE id = p_user_id;
    END IF;
  ELSE
    IF p_action = 'grant' THEN
      UPDATE public.users SET
        gold_trial_activated_at = NOW(),
        gold_trial_expires_at = NOW() + (p_days || ' days')::interval,
        updated_at = NOW()
      WHERE id = p_user_id;
    ELSIF p_action = 'extend' THEN
      UPDATE public.users SET
        gold_trial_expires_at = COALESCE(gold_trial_expires_at, NOW()) + (p_days || ' days')::interval,
        updated_at = NOW()
      WHERE id = p_user_id;
    ELSIF p_action = 'revoke' THEN
      UPDATE public.users SET gold_trial_expires_at = NOW(), updated_at = NOW() WHERE id = p_user_id;
    END IF;
  END IF;

  INSERT INTO public.subscription_events (user_id, event_type, metadata)
  VALUES (
    p_user_id,
    'admin_trial_' || p_action,
    jsonb_build_object('trial_type', p_trial_type || '_7_day', 'days', p_days, 'admin_id', p_admin_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_trial(UUID, TEXT, TEXT, INT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_trial(UUID, TEXT, TEXT, INT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cron: trial-expiring-sweep (daily 00:04 UTC, before expiry check)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-expiring-sweep') THEN
      PERFORM cron.unschedule('trial-expiring-sweep');
    END IF;
    PERFORM cron.schedule(
      'trial-expiring-sweep',
      '4 0 * * *',
      $job$
      SELECT net.http_post(
        url := coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1),
          'https://othikifibhjpfgyxpzcu.supabase.co'
        ) || '/functions/v1/trial-expiring-sweep',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  END IF;
END;
$cron$;

-- ---------------------------------------------------------------------------
-- Cron: check-subscription-expiry — vault URL pattern (align with goodwill sweep)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-subscription-expiry') THEN
      PERFORM cron.unschedule('check-subscription-expiry');
    END IF;
    PERFORM cron.schedule(
      'check-subscription-expiry',
      '5 0 * * *',
      $job$
      SELECT net.http_post(
        url := coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1),
          current_setting('app.settings.supabase_url', true),
          'https://othikifibhjpfgyxpzcu.supabase.co'
        ) || '/functions/v1/check-subscription-expiry',
        -- After deploy: reschedule in SQL Editor with x-cron-secret (same as trial-expiring-sweep).
        -- MOOD_EXPIRY_CRON_SECRET must be set on the Edge Function.
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  END IF;
END;
$cron$;

NOTIFY pgrst, 'reload schema';
