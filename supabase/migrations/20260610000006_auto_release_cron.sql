-- Auto-release escrow 24h after plan completion (no open dispute)

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.plans
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.sweep_completed_plan_auto_release()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow_id UUID;
  v_released INT := 0;
BEGIN
  FOR v_escrow_id IN
    SELECT e.id
    FROM public.escrow_transactions e
    INNER JOIN public.plans p ON p.id = e.plan_id
    WHERE p.status = 'completed'
      AND COALESCE(p.completed_at, p.updated_at) < now() - interval '24 hours'
      AND e.status IN ('funded', 'active')
      AND NOT EXISTS (
        SELECT 1 FROM public.escrow_disputes d
        WHERE d.escrow_id = e.id
          AND d.status IN ('open', 'under_review')
      )
  LOOP
    PERFORM public._escrow_release_internal(v_escrow_id, true);
    v_released := v_released + 1;
  END LOOP;

  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_completed_plan_auto_release() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_completed_plan_auto_release() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('auto-release-sweep');
    PERFORM cron.schedule(
      'auto-release-sweep',
      '0 * * * *',
      $job$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/auto-release-sweep',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.payment_reminder_cron_secret', true)
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  END IF;
END;
$cron$;

NOTIFY pgrst, 'reload schema';
