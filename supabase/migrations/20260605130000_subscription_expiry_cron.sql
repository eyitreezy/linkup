/**
 * Daily subscription expiry check — requires pg_cron + pg_net on hosted Supabase.
 * Configure Dashboard → Database → Extensions: pg_cron, pg_net.
 * Set secrets: app.supabase_url, app.service_role_key (or invoke via Dashboard cron).
 */
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check-subscription-expiry');
    PERFORM cron.schedule(
      'check-subscription-expiry',
      '5 0 * * *',
      $job$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/check-subscription-expiry',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  END IF;
END;
$cron$;
