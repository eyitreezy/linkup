-- Support & dispute resolution gaps: fund actions, ticket threading, concierge, notifications

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
ALTER TABLE public.escrow_disputes
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS is_concierge BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL DEFAULT 'admin'
    CHECK (sender_role IN ('admin', 'member', 'system')),
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.ticket_replies (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.escrow_dispute_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_dispute_id UUID NOT NULL REFERENCES public.escrow_disputes (id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_dispute_admin_actions_dispute
  ON public.escrow_dispute_admin_actions (escrow_dispute_id, created_at);

-- ---------------------------------------------------------------------------
-- ticket_replies RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_replies_member_select ON public.ticket_replies;
CREATE POLICY ticket_replies_member_select ON public.ticket_replies
  FOR SELECT TO authenticated
  USING (
    is_internal = FALSE
    AND ticket_id IN (
      SELECT id FROM public.support_tickets WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ticket_replies_admin_all ON public.ticket_replies;
CREATE POLICY ticket_replies_admin_all ON public.ticket_replies
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS ticket_replies_member_insert ON public.ticket_replies;
CREATE POLICY ticket_replies_member_insert ON public.ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'member'
    AND sender_id = auth.uid()
    AND is_internal = FALSE
    AND ticket_id IN (
      SELECT id FROM public.support_tickets WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.escrow_dispute_admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escrow_dispute_admin_actions_admin ON public.escrow_dispute_admin_actions;
CREATE POLICY escrow_dispute_admin_actions_admin ON public.escrow_dispute_admin_actions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Realtime (ignore if already added)
DO $rl$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$rl$;

-- ---------------------------------------------------------------------------
-- admin_resolve_escrow_dispute — release / refund / split with wallet action
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_escrow_dispute(
  p_dispute_id UUID,
  p_decision TEXT,
  p_split_bps INT DEFAULT NULL,
  p_resolution_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute public.escrow_disputes%ROWTYPE;
  v_escrow public.escrow_transactions%ROWTYPE;
  v_fee INT;
  v_net INT;
  v_payee_amount INT;
  v_payer_amount INT;
  v_ref TEXT;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF p_decision NOT IN ('release', 'refund', 'split') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  IF p_decision = 'split' AND (p_split_bps IS NULL OR p_split_bps < 0 OR p_split_bps > 10000) THEN
    RAISE EXCEPTION 'invalid_split_bps';
  END IF;

  SELECT * INTO v_dispute FROM public.escrow_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;

  IF v_dispute.status IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'dispute_already_closed';
  END IF;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE id = v_dispute.escrow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_not_found';
  END IF;

  IF v_escrow.status NOT IN ('disputed', 'funded', 'active') THEN
    RAISE EXCEPTION 'escrow_not_resolvable';
  END IF;

  v_fee := public.platform_fee_cents_for_amount(v_escrow.amount_cents);
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_fee);
  v_ref := v_escrow.id::text || ':admin:' || p_decision;

  IF p_decision = 'release' THEN
    IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payee_id,
        v_net,
        'admin_dispute_release',
        v_ref,
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'plan_id', v_escrow.plan_id)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = now(),
      platform_fee_cents = v_fee,
      updated_at = now()
    WHERE id = v_escrow.id;

  ELSIF p_decision = 'refund' THEN
    IF v_escrow.amount_cents > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_escrow.amount_cents,
        'admin_dispute_refund',
        v_ref,
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'plan_id', v_escrow.plan_id)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET status = 'refunded', released_at = now(), updated_at = now()
    WHERE id = v_escrow.id;

  ELSIF p_decision = 'split' THEN
    v_payee_amount := ROUND((v_net::numeric * p_split_bps) / 10000.0)::INT;
    v_payer_amount := GREATEST(0, v_escrow.amount_cents - v_payee_amount - v_fee);
    IF v_payee_amount > 0 AND v_escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payee_id,
        v_payee_amount,
        'admin_dispute_split_payee',
        v_ref || ':payee',
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'split_bps', p_split_bps)
      );
    END IF;
    IF v_payer_amount > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_payer_amount,
        'admin_dispute_split_payer',
        v_ref || ':payer',
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'split_bps', p_split_bps)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = now(),
      platform_fee_cents = v_fee,
      updated_at = now()
    WHERE id = v_escrow.id;
  END IF;

  UPDATE public.escrow_disputes
  SET
    status = 'resolved',
    resolved_at = now(),
    admin_resolution = p_decision,
    admin_note = COALESCE(p_resolution_note, admin_note)
  WHERE id = p_dispute_id;

  INSERT INTO public.escrow_dispute_admin_actions (escrow_dispute_id, admin_user_id, action, detail)
  VALUES (
    p_dispute_id,
    p_admin_id,
    'escrow_' || p_decision,
    jsonb_build_object(
      'decision', p_decision,
      'split_bps', p_split_bps,
      'note', p_resolution_note,
      'escrow_id', v_escrow.id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_escrow_dispute(UUID, TEXT, INT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_escrow_dispute(UUID, TEXT, INT, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_resolve_plan_dispute — wallet actions when escrow still funded
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_plan_dispute(
  p_dispute_id UUID,
  p_new_status TEXT,
  p_resolution TEXT,
  p_internal_notes TEXT DEFAULT NULL,
  p_partial_bps INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute public.disputes%ROWTYPE;
  v_escrow public.escrow_transactions%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_fee INT;
  v_net INT;
  v_guest_amount INT;
  v_host_amount INT;
  v_ref TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_new_status NOT IN ('resolved', 'rejected', 'reviewing', 'pending') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_dispute.plan_id;

  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE plan_id = v_dispute.plan_id
    AND status IN ('funded', 'active')
  ORDER BY created_at DESC
  LIMIT 1;

  IF p_new_status = 'resolved' AND v_escrow.id IS NOT NULL THEN
    v_fee := public.platform_fee_cents_for_amount(v_escrow.amount_cents);
    v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_fee);
    v_ref := v_dispute.id::text || ':plan_resolve';

    IF p_resolution = 'refund' THEN
      IF v_escrow.amount_cents > 0 AND v_escrow.payer_id IS NOT NULL THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.payer_id,
          v_escrow.amount_cents,
          'plan_dispute_refund',
          v_ref,
          jsonb_build_object('dispute_id', p_dispute_id, 'plan_id', v_dispute.plan_id)
        );
      END IF;
      UPDATE public.escrow_transactions
      SET status = 'refunded', released_at = now(), updated_at = now()
      WHERE id = v_escrow.id;

    ELSIF p_resolution = 'partial' AND p_partial_bps IS NOT NULL THEN
      v_guest_amount := ROUND((v_net::numeric * p_partial_bps) / 10000.0)::INT;
      v_host_amount := GREATEST(0, v_net - v_guest_amount);
      IF v_guest_amount > 0 AND v_escrow.payer_id IS NOT NULL THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.payer_id,
          v_guest_amount,
          'plan_dispute_partial_guest',
          v_ref || ':guest',
          jsonb_build_object('dispute_id', p_dispute_id, 'partial_bps', p_partial_bps)
        );
      END IF;
      IF v_host_amount > 0 AND v_escrow.payee_id IS NOT NULL THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.payee_id,
          v_host_amount,
          'plan_dispute_partial_host',
          v_ref || ':host',
          jsonb_build_object('dispute_id', p_dispute_id, 'partial_bps', p_partial_bps)
        );
      END IF;
      UPDATE public.escrow_transactions
      SET
        status = 'released',
        released_at = now(),
        platform_fee_cents = v_fee,
        updated_at = now()
      WHERE id = v_escrow.id;

    ELSIF p_resolution = 'none' AND v_plan.status = 'completed' THEN
      IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.payee_id,
          v_net,
          'plan_dispute_release',
          v_ref,
          jsonb_build_object('dispute_id', p_dispute_id, 'plan_id', v_dispute.plan_id)
        );
      END IF;
      UPDATE public.escrow_transactions
      SET
        status = 'released',
        released_at = now(),
        platform_fee_cents = v_fee,
        updated_at = now()
      WHERE id = v_escrow.id;
    END IF;
  END IF;

  UPDATE public.disputes
  SET
    status = p_new_status,
    resolution = CASE WHEN p_new_status = 'resolved' THEN p_resolution ELSE NULL END,
    internal_notes = COALESCE(p_internal_notes, internal_notes),
    admin_note = COALESCE(p_internal_notes, admin_note),
    resolved_at = CASE WHEN p_new_status IN ('resolved', 'rejected') THEN now() ELSE NULL END
  WHERE id = p_dispute_id;

  INSERT INTO public.dispute_admin_actions (dispute_id, admin_user_id, action, detail)
  VALUES (
    p_dispute_id,
    auth.uid(),
    'plan_' || COALESCE(p_resolution, p_new_status),
    jsonb_build_object(
      'status', p_new_status,
      'resolution', p_resolution,
      'partial_bps', p_partial_bps
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_plan_dispute(UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_plan_dispute(UUID, TEXT, TEXT, TEXT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Evidence purge — return paths for storage cleanup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_dispute_evidence_due_for_purge()
RETURNS TABLE (id UUID, file_path TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.file_path
  FROM public.dispute_evidence e
  WHERE e.purge_after IS NOT NULL
    AND e.purge_after < now()
    AND e.file_path IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.list_dispute_evidence_due_for_purge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_dispute_evidence_due_for_purge() TO service_role;

-- ---------------------------------------------------------------------------
-- Escrow dispute resolved notifications (both parties)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_escrow_dispute_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_counterparty UUID;
  v_decision TEXT;
BEGIN
  IF NEW.status IN ('resolved', 'dismissed')
    AND OLD.status IS DISTINCT FROM NEW.status
    AND OLD.status NOT IN ('resolved', 'dismissed') THEN
    SELECT * INTO v_escrow FROM public.escrow_transactions WHERE id = NEW.escrow_id;
    v_decision := COALESCE(NEW.admin_resolution, 'reviewed');
    v_counterparty := CASE
      WHEN v_escrow.payer_id = NEW.opened_by THEN v_escrow.payee_id
      ELSE v_escrow.payer_id
    END;

    PERFORM public.create_notification(
      NEW.opened_by,
      'dispute_resolved',
      'Dispute resolved',
      'Your escrow dispute has been reviewed and resolved.',
      jsonb_build_object(
        'escrowId', NEW.escrow_id::text,
        'decision', v_decision,
        'href', '/disputes'
      ),
      'high',
      'escrow_dispute_resolved:opener:' || NEW.id::text
    );

    IF v_counterparty IS NOT NULL THEN
      PERFORM public.create_notification(
        v_counterparty,
        'dispute_resolved',
        'Dispute resolved',
        'An escrow dispute on your plan has been resolved.',
        jsonb_build_object(
          'escrowId', NEW.escrow_id::text,
          'decision', v_decision,
          'href', '/disputes'
        ),
        'high',
        'escrow_dispute_resolved:counter:' || NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_escrow_dispute_resolved ON public.escrow_disputes;
CREATE TRIGGER trg_notify_escrow_dispute_resolved
  AFTER UPDATE OF status ON public.escrow_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_escrow_dispute_resolved();

-- ---------------------------------------------------------------------------
-- Plan dispute resolved — notify reported party (reporter handled by notify_dispute_change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_plan_dispute_reported_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'rejected')
    AND OLD.status IS DISTINCT FROM NEW.status
    AND OLD.status NOT IN ('resolved', 'rejected') THEN
    PERFORM public.create_notification(
      NEW.reported_user_id,
      'dispute_resolved',
      'Dispute resolved',
      'A dispute filed against you has been reviewed.',
      jsonb_build_object(
        'planId', NEW.plan_id::text,
        'disputeId', NEW.id::text,
        'href', '/disputes'
      ),
      'medium',
      'plan_dispute_resolved:reported:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_plan_dispute_reported_resolved ON public.disputes;
CREATE TRIGGER trg_notify_plan_dispute_reported_resolved
  AFTER UPDATE OF status ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_plan_dispute_reported_resolved();

-- ---------------------------------------------------------------------------
-- Cron: evidence purge sweep (weekly)
-- Function is deployed with --no-verify-jwt; optional x-cron-secret if
-- EVIDENCE_PURGE_CRON_SECRET is set on the Edge Function.
-- Vault project_url optional — hardcode URL if vault secret not created.
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evidence-purge-sweep') THEN
      PERFORM cron.unschedule('evidence-purge-sweep');
    END IF;
    PERFORM cron.schedule(
      'evidence-purge-sweep',
      '0 3 * * 0',
      $job$
      SELECT net.http_post(
        url := coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1),
          'https://othikifibhjpfgyxpzcu.supabase.co'
        ) || '/functions/v1/evidence-purge-sweep',
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
-- Ticket reply → notify member (non-internal admin replies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_ticket_reply_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF NEW.is_internal OR NEW.sender_role <> 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_owner FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    v_owner,
    'ticket_updated',
    'Support reply',
    'A support agent has replied to your ticket.',
    jsonb_build_object('href', '/support/ticket/' || NEW.ticket_id::text, 'ticketId', NEW.ticket_id::text),
    'medium',
    'ticket_reply:' || NEW.ticket_id::text || ':' || NEW.id::text
  );

  UPDATE public.support_tickets
  SET status = 'in_progress', updated_at = now()
  WHERE id = NEW.ticket_id AND status = 'open';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_reply_notify ON public.ticket_replies;
CREATE TRIGGER trg_ticket_reply_notify
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_reply_insert();

NOTIFY pgrst, 'reload schema';
