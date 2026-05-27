/**
 * Financial compliance MVP: cancellations (server rules), goodwill credits, agreement confirmations,
 * wallet ledger, financial event audit trail, subscriptions row, reconciliation log, profile views (premium).
 */

-- -----------------------------------------------------------------------------
-- agreement_confirmations (both required before plan → active / awaiting_payment / escrow insert)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agreement_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agreement_confirmations_plan ON public.agreement_confirmations (plan_id);

ALTER TABLE public.agreement_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agreement_confirmations_select ON public.agreement_confirmations;
CREATE POLICY agreement_confirmations_select ON public.agreement_confirmations FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.plans p
    LEFT JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.id = plan_id
    AND (p.creator_id = auth.uid() OR o.bidder_id = auth.uid())
  )
);

-- Inserts only via SECURITY DEFINER RPC
DROP POLICY IF EXISTS agreement_confirmations_no_insert ON public.agreement_confirmations;
CREATE POLICY agreement_confirmations_no_insert ON public.agreement_confirmations FOR INSERT WITH CHECK (false);

REVOKE INSERT ON public.agreement_confirmations FROM authenticated;

-- -----------------------------------------------------------------------------
-- subscriptions (catalog of basic / premium; mirrors Paystack-driven entitlements)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON public.subscriptions (expires_at);

CREATE OR REPLACE FUNCTION public.touch_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tr_subscriptions_touch ON public.subscriptions;
CREATE TRIGGER tr_subscriptions_touch BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_subscriptions_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS subscriptions_no_client_write ON public.subscriptions;
CREATE POLICY subscriptions_no_client_write ON public.subscriptions FOR ALL USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;

-- -----------------------------------------------------------------------------
-- cancellations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
  cancel_type TEXT NOT NULL CHECK (cancel_type IN ('early', 'late', 'no_show', 'mutual')),
  refund_amount INT NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  fee_amount INT NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  goodwill_credit_amount INT NOT NULL DEFAULT 0 CHECK (goodwill_credit_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancellations_plan ON public.cancellations (plan_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_user ON public.cancellations (user_id);

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cancellations_select ON public.cancellations;
CREATE POLICY cancellations_select ON public.cancellations FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.plans p
    LEFT JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.id = plan_id AND (p.creator_id = auth.uid() OR o.bidder_id = auth.uid())
  )
);

DROP POLICY IF EXISTS cancellations_no_write ON public.cancellations;
CREATE POLICY cancellations_no_write ON public.cancellations FOR INSERT WITH CHECK (false);

REVOKE INSERT ON public.cancellations FROM authenticated;

-- -----------------------------------------------------------------------------
-- goodwill_credits (non-withdrawable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goodwill_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (source IN ('cancellation', 'dispute_resolution', 'promo')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 days'),
  used_amount INT NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goodwill_used_lte_amount CHECK (used_amount <= amount)
);

CREATE INDEX IF NOT EXISTS idx_goodwill_user ON public.goodwill_credits (user_id, expires_at);

ALTER TABLE public.goodwill_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goodwill_select ON public.goodwill_credits;
CREATE POLICY goodwill_select ON public.goodwill_credits FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS goodwill_no_write ON public.goodwill_credits;
CREATE POLICY goodwill_no_write ON public.goodwill_credits FOR INSERT WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.goodwill_credits FROM authenticated;

-- -----------------------------------------------------------------------------
-- wallet_ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  source TEXT NOT NULL CHECK (source IN ('escrow_release', 'goodwill', 'refund', 'fee', 'adjustment')),
  amount INT NOT NULL CHECK (amount >= 0),
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON public.wallet_ledger (user_id, created_at DESC);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_ledger_select ON public.wallet_ledger;
CREATE POLICY wallet_ledger_select ON public.wallet_ledger FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS wallet_ledger_no_write ON public.wallet_ledger;
CREATE POLICY wallet_ledger_no_write ON public.wallet_ledger FOR INSERT WITH CHECK (false);

REVOKE INSERT ON public.wallet_ledger FROM authenticated;

-- -----------------------------------------------------------------------------
-- withdrawals (phase-ready)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals (user_id);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawals_select ON public.withdrawals;
CREATE POLICY withdrawals_select ON public.withdrawals FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS withdrawals_insert_own ON public.withdrawals;
CREATE POLICY withdrawals_insert_own ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS withdrawals_update_admin ON public.withdrawals;
CREATE POLICY withdrawals_update_admin ON public.withdrawals FOR UPDATE USING (public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- financial_events (append-only audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'escrow_created',
      'escrow_funded',
      'escrow_released',
      'escrow_refunded',
      'escrow_disputed',
      'wallet_credit',
      'wallet_debit',
      'goodwill_issued',
      'cancellation',
      'reconciliation_note'
    )
  ),
  amount INT NOT NULL DEFAULT 0,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_events_idem_idx
  ON public.financial_events (reference_id, event_type)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_events_user ON public.financial_events (user_id, created_at DESC);

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_events_select ON public.financial_events;
CREATE POLICY financial_events_select ON public.financial_events FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS financial_events_no_write ON public.financial_events;
CREATE POLICY financial_events_no_write ON public.financial_events FOR INSERT WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.financial_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.deny_financial_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS tr_financial_events_immutable ON public.financial_events;
CREATE TRIGGER tr_financial_events_immutable
BEFORE UPDATE OR DELETE ON public.financial_events
FOR EACH ROW EXECUTE FUNCTION public.deny_financial_event_mutation();

-- -----------------------------------------------------------------------------
-- reconciliation_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_run DATE NOT NULL DEFAULT (CURRENT_DATE),
  status TEXT NOT NULL CHECK (status IN ('ok', 'mismatch', 'error', 'stub')),
  discrepancies JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconciliation_logs_admin ON public.reconciliation_logs;
CREATE POLICY reconciliation_logs_admin ON public.reconciliation_logs FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS reconciliation_logs_no_insert_client ON public.reconciliation_logs;
CREATE POLICY reconciliation_logs_no_insert_client ON public.reconciliation_logs FOR INSERT WITH CHECK (false);

REVOKE INSERT ON public.reconciliation_logs FROM authenticated;

-- -----------------------------------------------------------------------------
-- mutual cancel votes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mutual_plan_cancel_votes (
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

ALTER TABLE public.mutual_plan_cancel_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mutual_cancel_select ON public.mutual_plan_cancel_votes;
CREATE POLICY mutual_cancel_select ON public.mutual_plan_cancel_votes FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.plans p
    LEFT JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.id = plan_id AND (p.creator_id = auth.uid() OR o.bidder_id = auth.uid())
  )
);

DROP POLICY IF EXISTS mutual_cancel_no_write ON public.mutual_plan_cancel_votes;
CREATE POLICY mutual_cancel_no_write ON public.mutual_plan_cancel_votes FOR INSERT WITH CHECK (false);

REVOKE INSERT, DELETE ON public.mutual_plan_cancel_votes FROM authenticated;

-- -----------------------------------------------------------------------------
-- profile_views (premium: who viewed me)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  viewed_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON public.profile_views (viewed_user_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_views_insert_self ON public.profile_views;
CREATE POLICY profile_views_insert_self ON public.profile_views FOR INSERT WITH CHECK (auth.uid() = viewer_id AND viewer_id <> viewed_user_id);

DROP POLICY IF EXISTS profile_views_select_premium ON public.profile_views;
CREATE POLICY profile_views_select_premium ON public.profile_views FOR SELECT USING (
  viewed_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
    AND s.status = 'active'
    AND s.plan = 'premium'
    AND s.expires_at > now()
  )
);

-- Admin can audit
DROP POLICY IF EXISTS profile_views_admin ON public.profile_views;
CREATE POLICY profile_views_admin ON public.profile_views FOR SELECT USING (public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- Disputes: priority queue for premium reporters (requires public.disputes)
-- -----------------------------------------------------------------------------
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS priority_review BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.disputes_set_priority_review()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.priority_review := EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = NEW.reporter_id
    AND s.status = 'active'
    AND s.plan = 'premium'
    AND s.expires_at > now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_disputes_priority ON public.disputes;
CREATE TRIGGER tr_disputes_priority
BEFORE INSERT ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.disputes_set_priority_review();

-- -----------------------------------------------------------------------------
-- Plan transition: require two agreement confirmations
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_plan_agreement_confirmations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_n INT;
BEGIN
  IF OLD.status = 'agreed' AND NEW.status IN ('active', 'awaiting_payment') THEN
    SELECT COUNT(DISTINCT user_id) INTO v_n FROM public.agreement_confirmations WHERE plan_id = NEW.id;
    IF COALESCE(v_n, 0) < 2 THEN
      RAISE EXCEPTION 'Both parties must confirm the agreement summary before continuing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_plans_agreement_confirm ON public.plans;
CREATE TRIGGER tr_plans_agreement_confirm
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_agreement_confirmations();

-- -----------------------------------------------------------------------------
-- Escrow insert defense: two confirmations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS escrow_insert ON public.escrow_transactions;
CREATE POLICY escrow_insert ON public.escrow_transactions FOR INSERT
WITH CHECK (
  (auth.uid() = payer_id OR auth.uid() = payee_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.verification_status = 'verified'
  )
  AND (
    SELECT COUNT(DISTINCT ac.user_id)
    FROM public.agreement_confirmations ac
    WHERE ac.plan_id = escrow_transactions.plan_id
  ) >= 2
);

-- -----------------------------------------------------------------------------
-- append_financial_event (idempotent on reference_id + event_type)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_financial_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_amount INT,
  p_reference_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_reference_id IS NOT NULL THEN
    SELECT fe.id INTO v_id
    FROM public.financial_events fe
    WHERE fe.reference_id = p_reference_id AND fe.event_type = p_event_type
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  INSERT INTO public.financial_events (user_id, event_type, amount, reference_id, metadata)
  VALUES (p_user_id, p_event_type, p_amount, p_reference_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_financial_event(UUID, TEXT, INT, TEXT, JSONB) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- record_agreement_confirmation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_agreement_confirmation(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT CASE WHEN p.creator_id = auth.uid() THEN o.bidder_id ELSE p.creator_id END
  INTO v_other
  FROM public.plans p
  JOIN public.plan_offers o ON o.id = p.accepted_offer_id
  WHERE p.id = p_plan_id AND p.status = 'agreed'
    AND (p.creator_id = auth.uid() OR o.bidder_id = auth.uid());
  IF v_other IS NULL THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;

  INSERT INTO public.agreement_confirmations (plan_id, user_id, confirmed_at)
  VALUES (p_plan_id, auth.uid(), now())
  ON CONFLICT (plan_id, user_id) DO UPDATE SET confirmed_at = EXCLUDED.confirmed_at;

  PERFORM public.create_notification(
    auth.uid(),
    'agreement_confirmed',
    'You confirmed the plan',
    'Thanks — we saved your agreement confirmation.',
    jsonb_build_object('plan_id', p_plan_id),
    'low',
    NULL
  );

  PERFORM public.create_notification(
    v_other,
    'agreement_update',
    'Plan agreement update',
    'The other person reviewed and confirmed the plan summary.',
    jsonb_build_object('plan_id', p_plan_id),
    'low',
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_agreement_confirmation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_agreement_confirmation(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Internal: wallet + goodwill helpers (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._wallet_credit_internal(
  p_user_id UUID,
  p_amount INT,
  p_source TEXT,
  p_reference TEXT,
  p_meta JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.wallet_ledger (user_id, type, source, amount, reference_id)
  VALUES (p_user_id, 'credit', p_source, p_amount, p_reference);
  PERFORM public.append_financial_event(
    p_user_id,
    'wallet_credit',
    p_amount,
    'wallet:' || COALESCE(p_reference, gen_random_uuid()::text),
    COALESCE(p_meta, '{}'::jsonb)
  );
  PERFORM public.create_notification(
    p_user_id,
    'wallet_updated',
    'Wallet update',
    'Your LinkUp balance changed. Open the wallet for details.',
    jsonb_build_object('reference', p_reference),
    'medium',
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public._wallet_credit_internal(UUID, INT, TEXT, TEXT, JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._goodwill_issue_internal(
  p_user_id UUID,
  p_amount INT,
  p_source TEXT,
  p_reference TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.goodwill_credits (user_id, amount, source, expires_at)
  VALUES (p_user_id, p_amount, p_source, now() + interval '60 days');
  PERFORM public.append_financial_event(
    p_user_id,
    'goodwill_issued',
    p_amount,
    'goodwill:' || COALESCE(p_reference, gen_random_uuid()::text),
    jsonb_build_object('source', p_source)
  );
  PERFORM public.create_notification(
    p_user_id,
    'credit_issued',
    'Goodwill credit',
    'We added a goodwill credit to your account. It applies to fees automatically.',
    '{}'::jsonb,
    'medium',
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public._goodwill_issue_internal(UUID, INT, TEXT, TEXT) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- submit_plan_cancellation (single-party; server-derived band from time to meetup)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_plan_cancellation(
  p_plan_id UUID,
  p_no_show BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan RECORD;
  v_offer RECORD;
  v_escrow RECORD;
  v_role TEXT;
  v_meet TIMESTAMPTZ;
  v_hours DOUBLE PRECISION;
  v_total INT;
  v_refund INT;
  v_fee INT;
  v_type TEXT;
  v_goodwill INT := 0;
  v_goodwill_user UUID := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  IF v_plan.accepted_offer_id IS NULL THEN RAISE EXCEPTION 'no_accepted_offer'; END IF;
  SELECT * INTO v_offer FROM public.plan_offers WHERE id = v_plan.accepted_offer_id;

  IF v_plan.creator_id = v_uid THEN v_role := 'host';
  ELSIF v_offer.bidder_id = v_uid THEN v_role := 'guest';
  ELSE RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_plan.status NOT IN ('agreed', 'awaiting_payment', 'active') THEN
    RAISE EXCEPTION 'plan_not_cancellable';
  END IF;

  v_meet := COALESCE(v_plan.agreed_scheduled_at, v_plan.scheduled_at, now() + interval '48 hours');
  v_hours := EXTRACT(EPOCH FROM (v_meet - now())) / 3600.0;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE plan_id = p_plan_id ORDER BY created_at DESC LIMIT 1;
  v_total := COALESCE(v_escrow.amount_cents, v_plan.agreed_price_cents, v_offer.amount_cents, 0);
  IF v_total < 0 THEN v_total := 0; END IF;

  IF p_no_show THEN
    v_type := 'no_show';
    v_refund := FLOOR(v_total * 0.05);
  ELSIF v_hours >= 24 THEN
    v_type := 'early';
    v_refund := v_total;
  ELSIF v_hours >= 6 THEN
    v_type := 'late';
    v_refund := FLOOR(v_total * 0.70);
  ELSE
    v_type := 'late';
    v_refund := FLOOR(v_total * 0.40);
  END IF;

  v_fee := GREATEST(v_total - v_refund, 0);

  -- Late host-cancel goodwill to guest (small)
  IF v_role = 'host' AND v_hours < 6 AND NOT p_no_show THEN
    v_goodwill := LEAST(500, GREATEST(100, FLOOR(v_fee * 0.15)));
    v_goodwill_user := v_offer.bidder_id;
  ELSIF v_role = 'guest' AND v_hours < 6 AND NOT p_no_show THEN
    v_goodwill := LEAST(400, GREATEST(100, FLOOR(v_fee * 0.10)));
    v_goodwill_user := v_plan.creator_id;
  END IF;

  INSERT INTO public.cancellations (plan_id, user_id, role, cancel_type, refund_amount, fee_amount, goodwill_credit_amount)
  VALUES (p_plan_id, v_uid, v_role, v_type, v_refund, v_fee, COALESCE(v_goodwill, 0));

  -- Plan + offer cleanup
  UPDATE public.plan_offers SET status = 'declined' WHERE id = v_offer.id;
  UPDATE public.plans SET status = 'cancelled' WHERE id = p_plan_id;

  IF v_escrow.id IS NOT NULL AND v_escrow.status IN ('funded', 'active') THEN
    UPDATE public.escrow_transactions
    SET status = 'refunded', updated_at = now()
    WHERE id = v_escrow.id;
    IF v_refund > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_refund,
        'refund',
        v_escrow.id::text,
        jsonb_build_object('plan_id', p_plan_id, 'cancel_type', v_type)
      );
    END IF;
    PERFORM public.append_financial_event(
      v_escrow.payer_id,
      'escrow_refunded',
      v_refund,
      'escrow:' || v_escrow.id::text || ':user_cancel',
      jsonb_build_object('plan_id', p_plan_id, 'fee_retained_cents', v_fee)
    );
  ELSIF v_escrow.id IS NOT NULL AND v_escrow.status = 'pending_funding' THEN
    UPDATE public.escrow_transactions SET status = 'cancelled', updated_at = now() WHERE id = v_escrow.id;
  END IF;

  IF v_goodwill > 0 AND v_goodwill_user IS NOT NULL THEN
    PERFORM public._goodwill_issue_internal(v_goodwill_user, v_goodwill, 'cancellation', p_plan_id::text);
  END IF;

  PERFORM public.append_financial_event(
    v_uid,
    'cancellation',
    v_refund,
    'cancel:' || p_plan_id::text || ':' || v_uid::text,
    jsonb_build_object('role', v_role, 'cancel_type', v_type)
  );

  PERFORM public.create_notification(
    v_offer.bidder_id,
    'plan_cancelled',
    'Plan cancelled',
    'A meetup you were matched on was cancelled. Check the app for refund and timing details.',
    jsonb_build_object('plan_id', p_plan_id),
    'high',
    NULL
  );
  PERFORM public.create_notification(
    v_plan.creator_id,
    'plan_cancelled',
    'Plan cancelled',
    'A meetup was cancelled. Check the app for refund and timing details.',
    jsonb_build_object('plan_id', p_plan_id),
    'high',
    NULL
  );

  RETURN jsonb_build_object(
    'cancel_type', v_type,
    'refund_amount', v_refund,
    'fee_amount', v_fee,
    'goodwill_credit', COALESCE(v_goodwill, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_plan_cancellation(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_plan_cancellation(UUID, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- vote_mutual_plan_cancel — full refund to payer when both parties voted
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_mutual_plan_cancel(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan RECORD;
  v_offer RECORD;
  v_escrow RECORD;
  v_cnt INT;
  v_total INT;
  v_payer UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF v_plan.accepted_offer_id IS NULL THEN RAISE EXCEPTION 'no_accepted_offer'; END IF;
  SELECT * INTO v_offer FROM public.plan_offers WHERE id = v_plan.accepted_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_accepted_offer'; END IF;
  IF NOT (v_uid IN (v_plan.creator_id, v_offer.bidder_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.mutual_plan_cancel_votes (plan_id, user_id) VALUES (p_plan_id, v_uid)
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO v_cnt FROM public.mutual_plan_cancel_votes WHERE plan_id = p_plan_id;
  IF v_cnt < 2 THEN
    RETURN jsonb_build_object('status', 'pending_votes', 'votes', v_cnt);
  END IF;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE plan_id = p_plan_id ORDER BY created_at DESC LIMIT 1;
  v_total := COALESCE(v_escrow.amount_cents, 0);
  v_payer := v_escrow.payer_id;

  INSERT INTO public.cancellations (plan_id, user_id, role, cancel_type, refund_amount, fee_amount, goodwill_credit_amount)
  VALUES
    (p_plan_id, v_plan.creator_id, 'host', 'mutual', 0, 0, 0),
    (p_plan_id, v_offer.bidder_id, 'guest', 'mutual', 0, 0, 0);

  UPDATE public.plan_offers SET status = 'declined' WHERE id = v_offer.id;
  UPDATE public.plans SET status = 'cancelled' WHERE id = p_plan_id;
  DELETE FROM public.mutual_plan_cancel_votes WHERE plan_id = p_plan_id;

  IF v_escrow.id IS NOT NULL AND v_escrow.status IN ('funded', 'active') THEN
    UPDATE public.escrow_transactions SET status = 'refunded', updated_at = now() WHERE id = v_escrow.id;
    IF v_total > 0 AND v_payer IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_payer,
        v_total,
        'refund',
        v_escrow.id::text || ':mutual',
        jsonb_build_object('plan_id', p_plan_id, 'mutual', true)
      );
    END IF;
    PERFORM public.append_financial_event(
      v_payer,
      'escrow_refunded',
      v_total,
      'escrow:' || v_escrow.id::text || ':mutual',
      jsonb_build_object('plan_id', p_plan_id, 'mutual', true)
    );
  ELSIF v_escrow.id IS NOT NULL THEN
    UPDATE public.escrow_transactions SET status = 'cancelled', updated_at = now() WHERE id = v_escrow.id;
  END IF;

  PERFORM public.append_financial_event(
    v_payer,
    'cancellation',
    v_total,
    'mutual_cancel:' || p_plan_id::text,
    jsonb_build_object('mutual', true)
  );

  RETURN jsonb_build_object('status', 'completed', 'refund_amount', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.vote_mutual_plan_cancel(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_mutual_plan_cancel(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Escrow financial sync triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tr_financial_log_escrow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.append_financial_event(
      NEW.payer_id,
      'escrow_created',
      NEW.amount_cents,
      'escrow:' || NEW.id::text || ':created',
      jsonb_build_object('plan_id', NEW.plan_id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'funded' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_funded',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':funded',
        jsonb_build_object('paystack_reference', NEW.paystack_reference)
      );
    ELSIF NEW.status = 'released' THEN
      PERFORM public.append_financial_event(
        NEW.payee_id,
        'escrow_released',
        COALESCE(NEW.amount_cents, 0) - COALESCE(NEW.platform_fee_cents, 0),
        'escrow:' || NEW.id::text || ':released',
        jsonb_build_object('fee', NEW.platform_fee_cents)
      );
    ELSIF NEW.status = 'disputed' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_disputed',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':disputed',
        '{}'::jsonb
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_escrow_financial ON public.escrow_transactions;
CREATE TRIGGER tr_escrow_financial
AFTER INSERT OR UPDATE OF status ON public.escrow_transactions
FOR EACH ROW EXECUTE FUNCTION public.tr_financial_log_escrow();

-- service role reconciliation stub insert
CREATE OR REPLACE FUNCTION public.run_reconciliation_stub(p_payload JSONB DEFAULT '[]'::jsonb)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  INSERT INTO public.reconciliation_logs (status, discrepancies)
  VALUES ('stub', COALESCE(p_payload, '[]'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.run_reconciliation_stub(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_reconciliation_stub(JSONB) TO authenticated;

COMMENT ON TABLE public.financial_events IS 'AppendONLY audit; never UPDATE/DELETE.';
COMMENT ON FUNCTION public.submit_plan_cancellation IS 'Server-side cancellation bands; updates escrow and wallet credits.';
