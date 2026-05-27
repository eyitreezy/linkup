/**
 * Trust & safety: verification audit trail, moderation logs, user reports,
 * plan feed suppression, admin notifications for reports.
 *
 * Vendor KYC maps to existing verification_request_status:
 *   approved  -> admin_approved
 *   rejected  -> admin_rejected
 *   more_info -> more_info
 */

-- ---------------------------------------------------------------------------
-- plans: hide from discovery when moderation escalates
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_plans_suppressed ON public.plans (is_suppressed) WHERE is_suppressed = false;

COMMENT ON COLUMN public.plans.is_suppressed IS 'When true, plan is hidden from public/radius discovery feeds (moderation).';

-- ---------------------------------------------------------------------------
-- verification_events (audit trail; inserts via SECURITY DEFINER triggers + service role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.verification_requests (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_events_verification ON public.verification_events (verification_id, created_at DESC);

ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_events_select ON public.verification_events;
CREATE POLICY verification_events_select ON public.verification_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.verification_requests v
      WHERE v.id = verification_id AND v.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- No client INSERT/UPDATE (triggers / Edge use service role or definer functions)

-- submitted + user notification
CREATE OR REPLACE FUNCTION public.trg_verification_request_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.verification_events (verification_id, event_type, metadata)
  VALUES (NEW.id, 'submitted', jsonb_build_object('user_id', NEW.user_id::text));

  PERFORM public.create_notification(
    NEW.user_id,
    'verification_submitted',
    'Verification received',
    'We received your documents. We''ll notify you when there''s an update.',
    jsonb_build_object('href', '/settings/verification'),
    'medium',
    'verification_submitted:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_verification_request_after_insert ON public.verification_requests;
CREATE TRIGGER tr_verification_request_after_insert
  AFTER INSERT ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_verification_request_after_insert();

-- status transition audit
CREATE OR REPLACE FUNCTION public.trg_verification_request_after_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.verification_events (verification_id, event_type, metadata)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object(
        'from', OLD.status::text,
        'to', NEW.status::text,
        'rejection_reason', NEW.rejection_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_verification_request_after_status ON public.verification_requests;
CREATE TRIGGER tr_verification_request_after_status
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_verification_request_after_status();

-- ---------------------------------------------------------------------------
-- Extend KYC user notifications (more_info)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_verification_request_notify_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'admin_approved'::public.verification_request_status THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'verification_updated',
      'You’re verified',
      'Your identity check passed. You can create plans, negotiate, and use escrow.',
      jsonb_build_object('href', '/settings/verification'),
      'high',
      'kyc_decision:' || NEW.id::text || ':approved'
    );
  ELSIF NEW.status = 'admin_rejected'::public.verification_request_status THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'verification_updated',
      'Verification needs another look',
      COALESCE(
        NULLIF(trim('We could not verify your documents. ' || COALESCE(NEW.rejection_reason, '')), ''),
        'We could not verify your documents. You can resubmit from Verification.'
      ),
      jsonb_build_object('href', '/settings/verification'),
      'high',
      'kyc_decision:' || NEW.id::text || ':rejected'
    );
  ELSIF NEW.status = 'more_info'::public.verification_request_status THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'verification_updated',
      'More information needed',
      COALESCE(
        NULLIF(trim('Please review and resubmit. ' || COALESCE(NEW.rejection_reason, '')), ''),
        'We need a bit more from you to finish verification. Open Verification to continue.'
      ),
      jsonb_build_object('href', '/settings/verification'),
      'high',
      'kyc_decision:' || NEW.id::text || ':more_info'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- moderation_logs (admin-readable; writes from Edge Function service role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('message', 'plan', 'profile')),
  content_id UUID NOT NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('spam', 'abuse', 'scam', 'explicit', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  ai_score NUMERIC(5, 4),
  action_taken TEXT NOT NULL DEFAULT 'none' CHECK (action_taken IN ('none', 'hidden', 'warned', 'banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_created ON public.moderation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_severity ON public.moderation_logs (severity, created_at DESC);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_logs_select_admin ON public.moderation_logs;
CREATE POLICY moderation_logs_select_admin ON public.moderation_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- reports (user-submitted safety reports)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('message', 'plan', 'profile', 'user')),
  content_id UUID,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports (reported_user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select ON public.reports;
CREATE POLICY reports_select ON public.reports
  FOR SELECT USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_reports_updated ON public.reports;
CREATE TRIGGER tr_reports_updated
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reports_updated_at();

-- Notify all admins (generic copy — no sensitive details in notification body)
CREATE OR REPLACE FUNCTION public.tr_reports_notify_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.admins
  LOOP
    PERFORM public.create_notification(
      r.user_id,
      'report_submitted',
      'New safety report',
      'A member submitted a report. Open Admin to review.',
      jsonb_build_object('href', '/admin'),
      'medium',
      'report_submitted:' || NEW.id::text || ':admin:' || r.user_id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_reports_notify_admins ON public.reports;
CREATE TRIGGER tr_reports_notify_admins
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_reports_notify_admins();

-- ---------------------------------------------------------------------------
-- Admin: read KYC verification files in private bucket (signed URLs from client)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS verification_storage_admin_read ON storage.objects;
CREATE POLICY verification_storage_admin_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification' AND public.is_admin(auth.uid()));
