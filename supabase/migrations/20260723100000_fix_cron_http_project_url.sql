-- Fix pg_cron + pg_net jobs that used app.settings.supabase_url (NULL on hosted → failed http_post).
-- Vault (recommended): project_url, payment_reminder_cron_secret, mood_expiry_cron_secret
-- matching Edge secrets PAYMENT_REMINDER_CRON_SECRET / MOOD_EXPIRY_CRON_SECRET.

CREATE OR REPLACE FUNCTION public.cron_project_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT rtrim(
    coalesce(
      nullif(trim((
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1
      )), ''),
      nullif(trim(current_setting('app.settings.supabase_url', true)), ''),
      'https://othikifibhjpfgyxpzcu.supabase.co'
    ),
    '/'
  );
$$;

REVOKE ALL ON FUNCTION public.cron_project_url() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_project_url() TO postgres;

CREATE OR REPLACE FUNCTION public.cron_vault_secret(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT nullif(trim((
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1
  )), '');
$$;

REVOKE ALL ON FUNCTION public.cron_vault_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_vault_secret(text) TO postgres;

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  -- check-subscription-expiry
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-subscription-expiry') THEN
    PERFORM cron.unschedule('check-subscription-expiry');
  END IF;
  PERFORM cron.schedule(
    'check-subscription-expiry',
    '5 0 * * *',
    $job$
    SELECT net.http_post(
      url := public.cron_project_url() || '/functions/v1/check-subscription-expiry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          public.cron_vault_secret('mood_expiry_cron_secret'),
          public.cron_vault_secret('subscription_expiry_cron_secret')
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );

  -- auto-release-sweep
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-release-sweep') THEN
    PERFORM cron.unschedule('auto-release-sweep');
  END IF;
  PERFORM cron.schedule(
    'auto-release-sweep',
    '0 * * * *',
    $job$
    SELECT net.http_post(
      url := public.cron_project_url() || '/functions/v1/auto-release-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.cron_vault_secret('payment_reminder_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );

  -- disbursement-sweep
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'disbursement-sweep') THEN
    PERFORM cron.unschedule('disbursement-sweep');
  END IF;
  PERFORM cron.schedule(
    'disbursement-sweep',
    '15 10 * * *',
    $job$
    SELECT net.http_post(
      url := public.cron_project_url() || '/functions/v1/disbursement-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.cron_vault_secret('payment_reminder_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );

  -- trial-expiring-sweep (ensure URL helper, optional secret header)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-expiring-sweep') THEN
    PERFORM cron.unschedule('trial-expiring-sweep');
  END IF;
  PERFORM cron.schedule(
    'trial-expiring-sweep',
    '4 0 * * *',
    $job$
    SELECT net.http_post(
      url := public.cron_project_url() || '/functions/v1/trial-expiring-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          public.cron_vault_secret('mood_expiry_cron_secret'),
          public.cron_vault_secret('trial_expiring_cron_secret')
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );

  -- goodwill-expiry-sweep
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'goodwill-expiry-sweep') THEN
    PERFORM cron.unschedule('goodwill-expiry-sweep');
  END IF;
  PERFORM cron.schedule(
    'goodwill-expiry-sweep',
    '0 9 * * *',
    $job$
    SELECT net.http_post(
      url := public.cron_project_url() || '/functions/v1/goodwill-expiry-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          public.cron_vault_secret('mood_expiry_cron_secret'),
          public.cron_vault_secret('goodwill_expiry_cron_secret')
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );

  -- evidence-purge-sweep
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evidence-purge-sweep') THEN
    PERFORM cron.unschedule('evidence-purge-sweep');
  END IF;
  PERFORM cron.schedule(
    'evidence-purge-sweep',
    '0 3 * * 0',
    $job$
    SELECT net.http_post(
      url := public.cron_project_url() || '/functions/v1/evidence-purge-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          public.cron_vault_secret('evidence_purge_cron_secret'),
          public.cron_vault_secret('mood_expiry_cron_secret')
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );
END;
$cron$;

NOTIFY pgrst, 'reload schema';
