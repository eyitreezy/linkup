/**
 * Plan disputes (user reports against a matched plan), evidence in private_disputes bucket,
 * contact-share strike ladder, dual confirmation for post-completion unlock, admin audit log.
 *
 * Apply via Supabase SQL Editor or CLI. Storage files: delete orphaned objects via Edge/cron
 * after rows are removed by purge_dispute_evidence_due() or manual admin cleanup.
 */

-- -----------------------------------------------------------------------------
-- Account status: banned (4th strike)
-- -----------------------------------------------------------------------------
ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'banned';

-- -----------------------------------------------------------------------------
-- Both parties confirmed attendance on a completed plan (contact-share unlock)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_completion_acks (
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_completion_acks_plan ON public.plan_completion_acks (plan_id);

ALTER TABLE public.plan_completion_acks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_completion_acks_select ON public.plan_completion_acks;
CREATE POLICY plan_completion_acks_select ON public.plan_completion_acks FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = plan_id
    AND (
      p.creator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.plan_offers o
        WHERE o.id = p.accepted_offer_id AND o.bidder_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS plan_completion_acks_insert_own ON public.plan_completion_acks;
CREATE POLICY plan_completion_acks_insert_own ON public.plan_completion_acks FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = plan_id
    AND p.status = 'completed'
    AND (
      p.creator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.plan_offers o
        WHERE o.id = p.accepted_offer_id AND o.bidder_id = auth.uid()
      )
    )
  )
);

-- Backfill: treat existing completed plans as dual-confirmed for unlock behavior
INSERT INTO public.plan_completion_acks (plan_id, user_id)
SELECT p.id, p.creator_id
FROM public.plans p
WHERE p.status = 'completed'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_completion_acks (plan_id, user_id)
SELECT p.id, o.bidder_id
FROM public.plans p
INNER JOIN public.plan_offers o ON o.id = p.accepted_offer_id
WHERE p.status = 'completed'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Disputes (plan-scoped; separate from escrow_disputes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('payment_issue', 'no_show', 'misconduct', 'scam', 'other')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewing', 'resolved', 'rejected')
  ),
  resolution TEXT CHECK (resolution IN ('refund', 'partial', 'none')),
  reporter_note TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT disputes_reporter_not_reported CHECK (reporter_id <> reported_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_reporter_plan
  ON public.disputes (plan_id, reporter_id)
  WHERE status IN ('pending', 'reviewing');

CREATE INDEX IF NOT EXISTS idx_disputes_plan ON public.disputes (plan_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status_created ON public.disputes (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'image', 'text')),
  file_path TEXT,
  text_body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purge_after TIMESTAMPTZ,
  CONSTRAINT dispute_evidence_file_or_text CHECK (
    (type = 'text' AND text_body IS NOT NULL AND file_path IS NULL)
    OR (type <> 'text' AND file_path IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON public.dispute_evidence (dispute_id, created_at);

CREATE TABLE IF NOT EXISTS public.dispute_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes (id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_admin_actions_dispute ON public.dispute_admin_actions (dispute_id, created_at);

-- -----------------------------------------------------------------------------
-- Strikes (contact policy / future reuse)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_strikes (
  user_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  strike_count INT NOT NULL DEFAULT 0 CHECK (strike_count >= 0),
  last_strike_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  suspended_until TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_counterparty_on_plan(p_plan_id UUID, p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    INNER JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.id = p_plan_id
      AND p.creator_id IN (p_a, p_b)
      AND o.bidder_id IN (p_a, p_b)
      AND p.creator_id <> o.bidder_id
  );
$$;

CREATE OR REPLACE FUNCTION public.pair_contact_share_unlocked(p_peer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plans p
    INNER JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.status = 'completed'
      AND p.creator_id IN (auth.uid(), p_peer_id)
      AND o.bidder_id IN (auth.uid(), p_peer_id)
      AND p.creator_id <> o.bidder_id
      AND (
        SELECT COUNT(DISTINCT a.user_id) FROM public.plan_completion_acks a WHERE a.plan_id = p.id
      ) >= 2
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_disputes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_touch ON public.disputes;
CREATE TRIGGER trg_disputes_touch
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.touch_disputes_updated_at();

CREATE OR REPLACE FUNCTION public.dispute_evidence_set_purge_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'rejected') THEN
    IF TG_OP = 'INSERT' OR COALESCE(OLD.status, '') NOT IN ('resolved', 'rejected') THEN
      UPDATE public.dispute_evidence
      SET purge_after = now() + interval '90 days'
      WHERE dispute_id = NEW.id AND purge_after IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_resolved_retention ON public.disputes;
CREATE TRIGGER trg_dispute_resolved_retention
AFTER INSERT OR UPDATE OF status ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.dispute_evidence_set_purge_after();

CREATE OR REPLACE FUNCTION public.notify_dispute_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.reporter_id,
      'dispute_created',
      'Report received',
      'We received your plan report. Our team will review it soon.',
      jsonb_build_object('dispute_id', NEW.id, 'plan_id', NEW.plan_id),
      'medium',
      NULL
    );
    PERFORM public.create_notification(
      NEW.reported_user_id,
      'dispute_created',
      'Safety update',
      'A plan-related concern is being reviewed. No action is required from you right now.',
      jsonb_build_object('dispute_id', NEW.id, 'plan_id', NEW.plan_id),
      'high',
      NULL
    );
    FOR v_admin IN SELECT user_id FROM public.admins WHERE user_id IS NOT NULL LOOP
      PERFORM public.create_notification(
        v_admin.user_id,
        'dispute_created',
        'New plan dispute',
        'A member filed a plan report. Open the admin dashboard to review.',
        jsonb_build_object('dispute_id', NEW.id, 'plan_id', NEW.plan_id),
        'high',
        NULL
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.create_notification(
      NEW.reporter_id,
      'dispute_updated',
      'Report update',
      'Your plan report status changed. Check the app for details.',
      jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status),
      'medium',
      NULL
    );
    PERFORM public.create_notification(
      NEW.reported_user_id,
      'dispute_updated',
      'Safety update',
      'An update is available on a plan report involving you.',
      jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status),
      'medium',
      NULL
    );
    IF NEW.status IN ('resolved', 'rejected') THEN
      PERFORM public.create_notification(
        NEW.reporter_id,
        'dispute_resolved',
        'Report resolved',
        'Your plan report has been closed by the review team.',
        jsonb_build_object('dispute_id', NEW.id, 'resolution', NEW.resolution),
        'medium',
        NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_notify ON public.disputes;
CREATE TRIGGER trg_disputes_notify
AFTER INSERT OR UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.notify_dispute_change();

-- Remove evidence rows whose retention window passed (run via pg_cron or scheduled SQL)
CREATE OR REPLACE FUNCTION public.purge_dispute_evidence_due()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  DELETE FROM public.dispute_evidence
  WHERE purge_after IS NOT NULL AND purge_after < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS: disputes
-- -----------------------------------------------------------------------------
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_strikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disputes_select_parties ON public.disputes;
CREATE POLICY disputes_select_parties ON public.disputes FOR SELECT USING (
  reporter_id = auth.uid()
  OR reported_user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS disputes_insert_reporter ON public.disputes;
CREATE POLICY disputes_insert_reporter ON public.disputes FOR INSERT WITH CHECK (
  reporter_id = auth.uid()
  AND public.user_is_counterparty_on_plan(plan_id, reporter_id, reported_user_id)
);

DROP POLICY IF EXISTS disputes_update_admin ON public.disputes;
CREATE POLICY disputes_update_admin ON public.disputes FOR UPDATE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS dispute_evidence_select ON public.dispute_evidence;
CREATE POLICY dispute_evidence_select ON public.dispute_evidence FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_id
    AND (
      d.reporter_id = auth.uid()
      OR d.reported_user_id = auth.uid()
      OR public.is_admin(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS dispute_evidence_insert ON public.dispute_evidence;
CREATE POLICY dispute_evidence_insert ON public.dispute_evidence FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.disputes d WHERE d.id = dispute_id AND d.reporter_id = auth.uid())
);

DROP POLICY IF EXISTS dispute_evidence_delete_admin ON public.dispute_evidence;
CREATE POLICY dispute_evidence_delete_admin ON public.dispute_evidence FOR DELETE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS dispute_admin_actions_select ON public.dispute_admin_actions;
CREATE POLICY dispute_admin_actions_select ON public.dispute_admin_actions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS dispute_admin_actions_insert ON public.dispute_admin_actions;
CREATE POLICY dispute_admin_actions_insert ON public.dispute_admin_actions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) AND admin_user_id = auth.uid());

DROP POLICY IF EXISTS user_strikes_select ON public.user_strikes;
CREATE POLICY user_strikes_select ON public.user_strikes FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

REVOKE INSERT, UPDATE, DELETE ON public.user_strikes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_strikes FROM anon;

-- -----------------------------------------------------------------------------
-- Strikes RPC: 1 warn, 2 final warn, 3 suspend 7d, 4 ban
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_contact_share_strike()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
  v_status TEXT;
  v_until TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.user_strikes (user_id, strike_count, last_strike_at, status)
  VALUES (v_uid, 1, now(), 'active')
  ON CONFLICT (user_id) DO UPDATE SET
    strike_count = public.user_strikes.strike_count + 1,
    last_strike_at = now();

  SELECT strike_count, status, suspended_until
  INTO v_count, v_status, v_until
  FROM public.user_strikes WHERE user_id = v_uid;

  IF v_count >= 4 THEN
    UPDATE public.user_strikes SET status = 'banned', suspended_until = NULL WHERE user_id = v_uid;
    UPDATE public.users SET account_status = 'banned'::public.account_status WHERE id = v_uid;
    PERFORM public.create_notification(
      v_uid,
      'user_banned',
      'Account update',
      'Your account access has been restricted. Contact support if you believe this is an error.',
      '{}'::jsonb,
      'high',
      NULL
    );
  ELSIF v_count >= 3 THEN
    UPDATE public.user_strikes
    SET status = 'suspended', suspended_until = now() + interval '7 days'
    WHERE user_id = v_uid;
    UPDATE public.users SET account_status = 'suspended'::public.account_status WHERE id = v_uid;
    PERFORM public.create_notification(
      v_uid,
      'user_suspended',
      '7-day suspension',
      'Your account is temporarily suspended after repeated contact-sharing attempts.',
      jsonb_build_object('until', (now() + interval '7 days')),
      'high',
      NULL
    );
  ELSE
    PERFORM public.create_notification(
      v_uid,
      'strike_added',
      'Reminder',
      'Sharing off-platform contacts before a plan is fully complete isn’t allowed. Further attempts may limit your account.',
      jsonb_build_object('strike_count', v_count),
      'medium',
      'strike:' || v_uid::text || ':' || v_count::text
    );
  END IF;

  SELECT strike_count, status, suspended_until
  INTO v_count, v_status, v_until
  FROM public.user_strikes WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'strike_count', v_count,
    'status', v_status,
    'suspended_until', v_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_contact_share_strike() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_contact_share_strike() TO authenticated;

REVOKE ALL ON FUNCTION public.pair_contact_share_unlocked(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_contact_share_unlocked(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.purge_dispute_evidence_due() FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- Admin resolve
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_plan_dispute(
  p_dispute_id UUID,
  p_new_status TEXT,
  p_resolution TEXT,
  p_internal_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_new_status NOT IN ('resolved', 'rejected', 'reviewing', 'pending') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.disputes
  SET
    status = p_new_status,
    resolution = CASE WHEN p_new_status = 'resolved' THEN p_resolution ELSE NULL END,
    internal_notes = COALESCE(p_internal_notes, internal_notes),
    resolved_at = CASE WHEN p_new_status IN ('resolved', 'rejected') THEN now() ELSE NULL END
  WHERE id = p_dispute_id;

  INSERT INTO public.dispute_admin_actions (dispute_id, admin_user_id, action, detail)
  VALUES (
    p_dispute_id,
    auth.uid(),
    'resolve',
    jsonb_build_object('status', p_new_status, 'resolution', p_resolution)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_plan_dispute(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_plan_dispute(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private_disputes
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private_disputes',
  'private_disputes',
  false,
  52428800,
  ARRAY['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS private_disputes_select ON storage.objects;
CREATE POLICY private_disputes_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'private_disputes'
  AND (
    split_part(name, '/', 1)::uuid IN (
      SELECT id FROM public.disputes
      WHERE reporter_id = auth.uid() OR reported_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS private_disputes_insert ON storage.objects;
CREATE POLICY private_disputes_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'private_disputes'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT id FROM public.disputes WHERE reporter_id = auth.uid()
  )
);

DROP POLICY IF EXISTS private_disputes_delete ON storage.objects;
CREATE POLICY private_disputes_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'private_disputes' AND public.is_admin(auth.uid())
);

COMMENT ON TABLE public.disputes IS 'User-filed plan disputes; media in storage bucket private_disputes (signed URLs only).';
COMMENT ON FUNCTION public.purge_dispute_evidence_due IS 'Deletes dispute_evidence rows past purge_after. Schedule weekly; remove storage objects with service role using returned paths if extended.';
