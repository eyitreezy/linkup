-- Group Plan Annexure B: arrival nudge, post-meetup confirmation, exigency reports,
-- policy sign-offs, auto-disbursement cron hooks.

-- -----------------------------------------------------------------------------
-- 1. Arrival nudges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_arrival_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  nudged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispute_eligible_at TIMESTAMPTZ NOT NULL,
  UNIQUE (plan_id, user_id)
);

CREATE OR REPLACE FUNCTION public.plan_arrival_nudges_set_dispute_eligible()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dispute_eligible_at := NEW.nudged_at + INTERVAL '1 hour';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_arrival_nudges_dispute_eligible ON public.plan_arrival_nudges;
CREATE TRIGGER trg_plan_arrival_nudges_dispute_eligible
  BEFORE INSERT ON public.plan_arrival_nudges
  FOR EACH ROW
  EXECUTE FUNCTION public.plan_arrival_nudges_set_dispute_eligible();

ALTER TABLE public.plan_arrival_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_plan_nudges ON public.plan_arrival_nudges;
CREATE POLICY users_read_own_plan_nudges ON public.plan_arrival_nudges
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.plan_offers po
      WHERE po.plan_id = plan_id
        AND po.bidder_id = auth.uid()
        AND po.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS users_insert_own_nudge ON public.plan_arrival_nudges;
CREATE POLICY users_insert_own_nudge ON public.plan_arrival_nudges
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_nudges_plan ON public.plan_arrival_nudges (plan_id);

-- -----------------------------------------------------------------------------
-- 2. Dispute evidence extensions (video metadata on disputes)
-- -----------------------------------------------------------------------------
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS video_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS video_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_gps_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS video_gps_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS nudge_timestamp TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 3. Group plan meetup confirmation per member
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_plan_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (plan_id, user_id)
);

ALTER TABLE public.group_plan_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_insert_own_confirmation ON public.group_plan_confirmations;
CREATE POLICY users_insert_own_confirmation ON public.group_plan_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS plan_parties_read_confirmations ON public.group_plan_confirmations;
CREATE POLICY plan_parties_read_confirmations ON public.group_plan_confirmations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.plan_offers po
      WHERE po.plan_id = plan_id
        AND po.bidder_id = auth.uid()
        AND po.status = 'accepted'
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Exigency reports
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exigency_outcome') THEN
    CREATE TYPE public.exigency_outcome AS ENUM (
      'pending_review',
      'late_arrival_confirmed',
      'force_majeure_approved',
      'no_report_auto',
      'unsatisfactory',
      'fairly_satisfactory'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.exigency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason_type TEXT NOT NULL CHECK (reason_type IN (
    'late_arrival', 'illness', 'accident', 'emergency', 'venue_issue', 'transport', 'other'
  )),
  reason_text TEXT NOT NULL,
  evidence_storage_path TEXT,
  outcome public.exigency_outcome NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID REFERENCES public.users (id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  refund_percent INT CHECK (refund_percent BETWEEN 0 AND 100),
  host_percent INT CHECK (host_percent BETWEEN 0 AND 100),
  refund_processed_at TIMESTAMPTZ,
  review_deadline_at TIMESTAMPTZ NOT NULL,
  UNIQUE (plan_id, user_id)
);

ALTER TABLE public.exigency_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_insert_own_exigency ON public.exigency_reports;
CREATE POLICY users_insert_own_exigency ON public.exigency_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS users_read_own_exigency ON public.exigency_reports;
CREATE POLICY users_read_own_exigency ON public.exigency_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_manage_exigency ON public.exigency_reports;
CREATE POLICY admin_manage_exigency ON public.exigency_reports
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_exigency_plan ON public.exigency_reports (plan_id);
CREATE INDEX IF NOT EXISTS idx_exigency_outcome ON public.exigency_reports (outcome);
CREATE INDEX IF NOT EXISTS idx_exigency_deadline ON public.exigency_reports (review_deadline_at)
  WHERE outcome = 'pending_review';

-- -----------------------------------------------------------------------------
-- 5. Group Plan Policy sign-off
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_plan_policy_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  policy_version TEXT NOT NULL DEFAULT 'v1.0',
  device_fingerprint TEXT,
  UNIQUE (user_id, policy_version)
);

ALTER TABLE public.group_plan_policy_signoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_signoff ON public.group_plan_policy_signoffs;
CREATE POLICY users_manage_own_signoff ON public.group_plan_policy_signoffs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. Escrow and Cancellation Policy sign-off (per plan)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_policy_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  policy_version TEXT NOT NULL DEFAULT 'v1.0',
  UNIQUE (plan_id, user_id)
);

ALTER TABLE public.escrow_policy_signoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_escrow_signoff ON public.escrow_policy_signoffs;
CREATE POLICY users_manage_own_escrow_signoff ON public.escrow_policy_signoffs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 7. Safety caveat acknowledgement
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.safety_caveat_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, user_id)
);

ALTER TABLE public.safety_caveat_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_caveat_ack ON public.safety_caveat_acknowledgements;
CREATE POLICY users_manage_own_caveat_ack ON public.safety_caveat_acknowledgements
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 8. Plan completion tracking (group meetup flow)
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS host_confirmed_completion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_status TEXT
    CHECK (completion_status IN ('pending', 'awaiting_confirm', 'confirmed', 'disputed'))
    DEFAULT 'pending';

-- -----------------------------------------------------------------------------
-- 9. RPC: submit_arrival_nudge
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_arrival_nudge(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _nudge_id UUID;
  _existing_nudge RECORD;
  _plan RECORD;
  _notify_user UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id, creator_id, status, scheduled_at INTO _plan
  FROM public.plans WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.status NOT IN ('active', 'agreed', 'awaiting_payment') THEN
    RAISE EXCEPTION 'plan_not_active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.plans WHERE id = p_plan_id AND creator_id = _user_id
    UNION ALL
    SELECT 1 FROM public.plan_offers
    WHERE plan_id = p_plan_id AND bidder_id = _user_id AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'not_a_participant';
  END IF;

  SELECT * INTO _existing_nudge
  FROM public.plan_arrival_nudges
  WHERE plan_id = p_plan_id AND user_id = _user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'nudge_id', _existing_nudge.id,
      'nudged_at', _existing_nudge.nudged_at,
      'already_nudged', true
    );
  END IF;

  INSERT INTO public.plan_arrival_nudges (plan_id, user_id)
  VALUES (p_plan_id, _user_id)
  RETURNING id INTO _nudge_id;

  FOR _notify_user IN
    SELECT DISTINCT u.id
    FROM (
      SELECT _plan.creator_id AS id
      WHERE _plan.creator_id <> _user_id
      UNION
      SELECT po.bidder_id AS id
      FROM public.plan_offers po
      WHERE po.plan_id = p_plan_id
        AND po.status = 'accepted'
        AND po.bidder_id <> _user_id
    ) u
  LOOP
    PERFORM public.create_notification(
      _notify_user,
      'partner_arrived',
      'Your meetup partner has arrived',
      'They are at the venue. Tap to confirm your own arrival.',
      jsonb_build_object('href', '/plan/' || p_plan_id, 'planId', p_plan_id::text),
      'medium',
      'partner_arrived:' || p_plan_id::text || ':' || _user_id::text
    );
  END LOOP;

  RETURN jsonb_build_object(
    'nudge_id', _nudge_id,
    'nudged_at', NOW(),
    'already_nudged', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_arrival_nudge(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_arrival_nudge(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. RPC: host confirms group meetup completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_group_meetup_confirmation(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _guest RECORD;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_group_plan'; END IF;
  IF _plan.creator_id <> _user_id THEN RAISE EXCEPTION 'not_host'; END IF;
  IF _plan.completion_status IS DISTINCT FROM 'awaiting_confirm' THEN
    RAISE EXCEPTION 'not_awaiting_confirmation';
  END IF;

  INSERT INTO public.group_plan_confirmations (plan_id, user_id, is_host)
  VALUES (p_plan_id, _user_id, true)
  ON CONFLICT (plan_id, user_id) DO NOTHING;

  UPDATE public.plans
  SET host_confirmed_completion_at = NOW(), updated_at = NOW()
  WHERE id = p_plan_id;

  FOR _guest IN
    SELECT po.bidder_id
    FROM public.plan_offers po
    WHERE po.plan_id = p_plan_id AND po.status = 'accepted'
  LOOP
    PERFORM public.create_notification(
      _guest.bidder_id,
      'meetup_confirm_request',
      'Did you attend the meetup?',
      'The host has confirmed the meetup. Please confirm your attendance.',
      jsonb_build_object(
        'href', '/plan/' || p_plan_id || '/confirm',
        'planId', p_plan_id::text
      ),
      'high',
      'meetup_confirm_request:' || p_plan_id::text || ':' || _guest.bidder_id::text
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'confirmed_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.submit_group_meetup_confirmation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_group_meetup_confirmation(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. RPC: guest confirms group attendance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_group_guest_confirmation(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_group_plan'; END IF;
  IF _plan.creator_id = _user_id THEN RAISE EXCEPTION 'use_host_confirmation'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.plan_offers
    WHERE plan_id = p_plan_id AND bidder_id = _user_id AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'not_a_guest';
  END IF;

  INSERT INTO public.group_plan_confirmations (plan_id, user_id, is_host)
  VALUES (p_plan_id, _user_id, false)
  ON CONFLICT (plan_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'confirmed_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.submit_group_guest_confirmation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_group_guest_confirmation(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 12. RPC: sweep group plan completion status at meetup time (T+0)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_group_plan_completion_status()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT := 0;
  _plan RECORD;
  _member UUID;
BEGIN
  FOR _plan IN
    SELECT p.id, p.title
    FROM public.plans p
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND COALESCE(p.completion_status, 'pending') = 'pending'
      AND p.scheduled_at IS NOT NULL
      AND p.scheduled_at <= NOW()
  LOOP
    UPDATE public.plans
    SET completion_status = 'awaiting_confirm', updated_at = NOW()
    WHERE id = _plan.id;

    _count := _count + 1;

    FOR _member IN
      SELECT DISTINCT u.id
      FROM (
        SELECT p.creator_id AS id FROM public.plans p WHERE p.id = _plan.id
        UNION
        SELECT po.bidder_id AS id
        FROM public.plan_offers po
        WHERE po.plan_id = _plan.id AND po.status = 'accepted'
      ) u
    LOOP
      PERFORM public.create_notification(
        _member,
        'meetup_confirm_t0',
        'Your Group Meetup is happening now',
        'Did everyone show up? Host will confirm. If you could not attend, submit an Exigency Report within 24 hours or a 50% auto outcome applies.',
        jsonb_build_object(
          'href', '/plan/' || _plan.id || '/confirm',
          'planId', _plan.id::text
        ),
        'high',
        'meetup_confirm_t0:' || _plan.id::text || ':' || _member::text
      );
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_group_plan_completion_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_group_plan_completion_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_group_plan_completion_status() TO postgres;

-- -----------------------------------------------------------------------------
-- 13. RPC: exigency auto-triggers at T+24h
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_group_plan_exigency_auto()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan RECORD;
  _guest RECORD;
  _auto_triggered INT := 0;
BEGIN
  PERFORM public.sweep_group_plan_completion_status();

  FOR _plan IN
    SELECT p.id, p.scheduled_at, p.creator_id
    FROM public.plans p
    WHERE COALESCE(p.is_group_plan, false)
      AND p.completion_status = 'awaiting_confirm'
      AND p.scheduled_at + INTERVAL '24 hours' < NOW()
  LOOP
    FOR _guest IN
      SELECT po.bidder_id
      FROM public.plan_offers po
      WHERE po.plan_id = _plan.id AND po.status = 'accepted'
        AND NOT EXISTS (
          SELECT 1 FROM public.group_plan_confirmations gpc
          WHERE gpc.plan_id = _plan.id AND gpc.user_id = po.bidder_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.exigency_reports er
          WHERE er.plan_id = _plan.id AND er.user_id = po.bidder_id
        )
    LOOP
      INSERT INTO public.exigency_reports (
        plan_id, user_id, reason_type, reason_text, outcome,
        refund_percent, host_percent, review_deadline_at, reviewed_at
      ) VALUES (
        _plan.id, _guest.bidder_id,
        'other', 'Auto-triggered: no report submitted within 24 hours',
        'no_report_auto', 50, 50,
        NOW(), NOW()
      )
      ON CONFLICT (plan_id, user_id) DO NOTHING;

      IF FOUND THEN
        _auto_triggered := _auto_triggered + 1;

        PERFORM public.create_notification(
          _guest.bidder_id,
          'exigency_auto_triggered',
          'Automatic outcome applied to your Group Plan',
          '50% of your contribution has been returned to your wallet. The remaining 50% went to the host. View in wallet.',
          jsonb_build_object('href', '/wallet', 'planId', _plan.id::text),
          'high',
          'exigency_auto:' || _plan.id::text || ':' || _guest.bidder_id::text
        );
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM public.plan_offers po
      WHERE po.plan_id = _plan.id AND po.status = 'accepted'
        AND NOT EXISTS (
          SELECT 1 FROM public.group_plan_confirmations gpc
          WHERE gpc.plan_id = _plan.id AND gpc.user_id = po.bidder_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.exigency_reports er
          WHERE er.plan_id = _plan.id AND er.user_id = po.bidder_id
        )
    ) THEN
      UPDATE public.plans
      SET completion_status = 'confirmed', auto_confirmed_at = NOW(), updated_at = NOW()
      WHERE id = _plan.id;
    END IF;
  END LOOP;

  RETURN _auto_triggered;
END;
$$;

REVOKE ALL ON FUNCTION public.process_group_plan_exigency_auto() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_group_plan_exigency_auto() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_group_plan_exigency_auto() TO postgres;

-- -----------------------------------------------------------------------------
-- 14. RPC: admin applies exigency outcome
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_apply_exigency_outcome(
  p_report_id UUID,
  p_outcome public.exigency_outcome,
  p_refund_percent INT,
  p_host_percent INT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _report public.exigency_reports%ROWTYPE;
BEGIN
  IF _admin IS NULL OR NOT public.is_admin(_admin) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO _report FROM public.exigency_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found'; END IF;

  UPDATE public.exigency_reports
  SET
    outcome = p_outcome,
    refund_percent = p_refund_percent,
    host_percent = p_host_percent,
    reviewed_by = _admin,
    reviewed_at = NOW(),
    review_notes = p_review_notes
  WHERE id = p_report_id;

  PERFORM public.create_notification(
    _report.user_id,
    'exigency_outcome_applied',
    'Exigency report reviewed',
    'Your exigency report has been reviewed. Check your wallet for updates.',
    jsonb_build_object('href', '/wallet', 'planId', _report.plan_id::text),
    'high',
    'exigency_outcome:' || p_report_id::text
  );

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_exigency_outcome(UUID, public.exigency_outcome, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_exigency_outcome(UUID, public.exigency_outcome, INT, INT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 15. RPC: confirmation reminder sweep (T+12h and T+23h)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_group_plan_confirmation_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT := 0;
  _row RECORD;
BEGIN
  -- T+12h reminder
  FOR _row IN
    SELECT p.id AS plan_id, po.bidder_id
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'
    WHERE COALESCE(p.is_group_plan, false)
      AND p.completion_status = 'awaiting_confirm'
      AND p.scheduled_at + INTERVAL '12 hours' < NOW()
      AND p.scheduled_at + INTERVAL '13 hours' > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.group_plan_confirmations gpc
        WHERE gpc.plan_id = p.id AND gpc.user_id = po.bidder_id
      )
  LOOP
    PERFORM public.create_notification(
      _row.bidder_id,
      'meetup_confirm_12h',
      'Confirmation window closes in 12 hours',
      'Confirmation window closes in 12 hours. Submit your Exigency Report now if you could not attend. After 24 hours, 50% of your contribution auto-returns.',
      jsonb_build_object(
        'href', '/plan/' || _row.plan_id || '/confirm',
        'planId', _row.plan_id::text
      ),
      'high',
      'meetup_confirm_12h:' || _row.plan_id::text || ':' || _row.bidder_id::text
    );
    _count := _count + 1;
  END LOOP;

  -- T+23h final reminder
  FOR _row IN
    SELECT p.id AS plan_id, po.bidder_id
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'
    WHERE COALESCE(p.is_group_plan, false)
      AND p.completion_status = 'awaiting_confirm'
      AND p.scheduled_at + INTERVAL '23 hours' < NOW()
      AND p.scheduled_at + INTERVAL '24 hours' > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.group_plan_confirmations gpc
        WHERE gpc.plan_id = p.id AND gpc.user_id = po.bidder_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.exigency_reports er
        WHERE er.plan_id = p.id AND er.user_id = po.bidder_id
      )
  LOOP
    PERFORM public.create_notification(
      _row.bidder_id,
      'meetup_confirm_23h',
      'Last chance to submit your Exigency Report',
      '1 hour left. Submit your Exigency Report before the window closes or the automatic 50%/50% outcome will apply.',
      jsonb_build_object(
        'href', '/plan/' || _row.plan_id || '/confirm',
        'planId', _row.plan_id::text
      ),
      'high',
      'meetup_confirm_23h:' || _row.plan_id::text || ':' || _row.bidder_id::text
    );
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_group_plan_confirmation_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_group_plan_confirmation_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_group_plan_confirmation_reminders() TO postgres;

-- -----------------------------------------------------------------------------
-- 16. Realtime
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_arrival_nudges;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_plan_confirmations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.exigency_reports;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 17. pg_cron
-- -----------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-plan-exigency-auto') THEN
      PERFORM cron.unschedule('group-plan-exigency-auto');
    END IF;
    PERFORM cron.schedule(
      'group-plan-exigency-auto',
      '*/15 * * * *',
      $$SELECT public.process_group_plan_exigency_auto()$$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-plan-confirmation-reminders') THEN
      PERFORM cron.unschedule('group-plan-confirmation-reminders');
    END IF;
    PERFORM cron.schedule(
      'group-plan-confirmation-reminders',
      '*/10 * * * *',
      $$SELECT public.sweep_group_plan_confirmation_reminders()$$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-plan-completion-status') THEN
      PERFORM cron.unschedule('group-plan-completion-status');
    END IF;
    PERFORM cron.schedule(
      'group-plan-completion-status',
      '*/5 * * * *',
      $$SELECT public.sweep_group_plan_completion_status()$$
    );
  END IF;
END;
$cron$;

NOTIFY pgrst, 'reload schema';
