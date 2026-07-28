-- Meetup confirmation, wallet disbursement queue, and withdrawal tracking

ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_source_check;

ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_source_check
  CHECK (source IN (
    'escrow_release', 'goodwill', 'refund',
    'fee', 'adjustment', 'withdrawal'
  ));

CREATE TABLE IF NOT EXISTS public.disbursement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  flutterwave_transfer_ref TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  failure_reason TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  wallet_ledger_debit_id UUID REFERENCES public.wallet_ledger(id),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disbursement_user
  ON public.disbursement_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disbursement_flw_ref
  ON public.disbursement_requests(flutterwave_transfer_ref);
CREATE INDEX IF NOT EXISTS idx_disbursement_status
  ON public.disbursement_requests(status);

ALTER TABLE public.disbursement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_read_own_disbursements ON public.disbursement_requests;
CREATE POLICY user_read_own_disbursements
  ON public.disbursement_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.unclaimed_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  source_wallet_ledger_id UUID REFERENCES public.wallet_ledger(id),
  source_escrow_id UUID REFERENCES public.escrow_transactions(id),
  reason TEXT NOT NULL CHECK (reason IN (
    'no_bank_account',
    'transfer_failed_max_retries',
    'disputed_amount',
    'user_inactive'
  )),
  status TEXT NOT NULL DEFAULT 'pending_account'
    CHECK (status IN (
      'pending_account',
      'admin_review',
      'claimed',
      'written_off'
    )),
  admin_notes TEXT,
  escalated_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unclaimed_user
  ON public.unclaimed_funds(user_id);
CREATE INDEX IF NOT EXISTS idx_unclaimed_status
  ON public.unclaimed_funds(status);

ALTER TABLE public.unclaimed_funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_read_own_unclaimed ON public.unclaimed_funds;
CREATE POLICY user_read_own_unclaimed
  ON public.unclaimed_funds FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.wallet_disbursement_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  source_wallet_ledger_id UUID NOT NULL REFERENCES public.wallet_ledger(id),
  disburse_after TIMESTAMPTZ NOT NULL,
  reminder_7_sent_at TIMESTAMPTZ,
  reminder_20_sent_at TIMESTAMPTZ,
  reminder_28_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'disbursed', 'unclaimed')),
  disbursement_request_id UUID REFERENCES public.disbursement_requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disburse_queue_source_ledger
  ON public.wallet_disbursement_queue(source_wallet_ledger_id);

CREATE INDEX IF NOT EXISTS idx_disburse_queue_user
  ON public.wallet_disbursement_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_disburse_queue_status_date
  ON public.wallet_disbursement_queue(status, disburse_after);

ALTER TABLE public.wallet_disbursement_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_read_own_queue ON public.wallet_disbursement_queue;
CREATE POLICY user_read_own_queue
  ON public.wallet_disbursement_queue FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._queue_escrow_release_disbursement(p_escrow_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallet_disbursement_queue (
    user_id,
    amount_cents,
    source_wallet_ledger_id,
    disburse_after
  )
  SELECT
    wl.user_id,
    wl.amount,
    wl.id,
    NOW() + INTERVAL '30 days'
  FROM public.wallet_ledger wl
  WHERE wl.source = 'escrow_release'
    AND wl.type = 'credit'
    AND wl.reference_id IN (
      p_escrow_id::text || ':manual',
      p_escrow_id::text || ':auto'
    )
  ORDER BY wl.created_at DESC
  LIMIT 1
  ON CONFLICT (source_wallet_ledger_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._queue_escrow_release_disbursement(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.confirm_meetup_happened(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_offer public.plan_offers%ROWTYPE;
  v_role TEXT;
  v_other_user_id UUID;
  v_escrow RECORD;
  v_released_count INT := 0;
  v_ack_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF v_plan.status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'plan_not_confirmable';
  END IF;

  IF v_plan.accepted_offer_id IS NOT NULL THEN
    SELECT * INTO v_offer FROM public.plan_offers WHERE id = v_plan.accepted_offer_id;
  END IF;

  IF v_plan.creator_id = v_uid THEN
    v_role := 'host';
  ELSE
    IF v_plan.accepted_offer_id IS NULL
      OR v_offer.bidder_id IS DISTINCT FROM v_uid
      OR v_offer.status <> 'accepted' THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    v_role := 'guest';
  END IF;

  IF v_plan.status = 'active' THEN
    UPDATE public.plans
    SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
    WHERE id = p_plan_id;
  END IF;

  INSERT INTO public.plan_completion_acks (plan_id, user_id)
  VALUES (p_plan_id, v_uid)
  ON CONFLICT (plan_id, user_id) DO NOTHING;

  SELECT COUNT(*) INTO v_ack_count
  FROM public.plan_completion_acks
  WHERE plan_id = p_plan_id;

  FOR v_escrow IN
    SELECT id FROM public.escrow_transactions
    WHERE plan_id = p_plan_id
      AND status IN ('funded', 'active')
  LOOP
    BEGIN
      PERFORM public._escrow_release_internal(v_escrow.id, false);
      v_released_count := v_released_count + 1;
      PERFORM public._queue_escrow_release_disbursement(v_escrow.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[confirm_meetup] escrow release failed for %: %', v_escrow.id, SQLERRM;
    END;
  END LOOP;

  IF v_role = 'host' THEN
    v_other_user_id := v_offer.bidder_id;
  ELSE
    v_other_user_id := v_plan.creator_id;
  END IF;

  IF v_other_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_other_user_id,
      'meetup_confirm_requested',
      'Did your meetup happen?',
      'Your meetup partner confirmed the meetup. Tap to confirm your side.',
      jsonb_build_object(
        'href', '/plan/' || p_plan_id || '/confirm',
        'planId', p_plan_id::text
      ),
      'high',
      'meetup_confirm:' || p_plan_id::text || ':' || v_other_user_id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'confirmed', true,
    'role', v_role,
    'escrows_released', v_released_count,
    'total_acks', v_ack_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_meetup_happened(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_meetup_happened(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.sweep_auto_confirm_meetups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_escrow RECORD;
  v_confirmed_count INT := 0;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
  v_guest_id UUID;
BEGIN
  FOR v_plan IN
    SELECT p.id, p.creator_id, p.accepted_offer_id,
           p.agreed_scheduled_at, p.scheduled_at
    FROM public.plans p
    WHERE p.status = 'active'
      AND COALESCE(p.agreed_scheduled_at, p.scheduled_at) < v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.escrow_disputes d
        JOIN public.escrow_transactions e ON e.id = d.escrow_id
        WHERE e.plan_id = p.id
          AND d.status IN ('open', 'under_review')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.disputes d
        WHERE d.plan_id = p.id
          AND d.status IN ('pending', 'reviewing')
      )
  LOOP
    BEGIN
      UPDATE public.plans
      SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
      WHERE id = v_plan.id
        AND status = 'active';

      FOR v_escrow IN
        SELECT id FROM public.escrow_transactions
        WHERE plan_id = v_plan.id
          AND status IN ('funded', 'active')
      LOOP
        BEGIN
          PERFORM public._escrow_release_internal(v_escrow.id, true);
          PERFORM public._queue_escrow_release_disbursement(v_escrow.id);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[auto_confirm] escrow release failed for %: %', v_escrow.id, SQLERRM;
        END;
      END LOOP;

      PERFORM public.create_notification(
        v_plan.creator_id,
        'meetup_auto_confirmed',
        'Meetup confirmed',
        'Your meetup has been automatically confirmed. Your funds are ready to withdraw.',
        jsonb_build_object('href', '/wallet', 'planId', v_plan.id::text),
        'high',
        'auto_confirm:' || v_plan.id::text || ':host'
      );

      SELECT bidder_id INTO v_guest_id FROM public.plan_offers WHERE id = v_plan.accepted_offer_id;
      IF v_guest_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_guest_id,
          'meetup_auto_confirmed',
          'Meetup confirmed',
          'Your meetup has been automatically confirmed. Your funds are ready to withdraw.',
          jsonb_build_object('href', '/wallet', 'planId', v_plan.id::text),
          'high',
          'auto_confirm:' || v_plan.id::text || ':guest'
        );
      END IF;

      v_confirmed_count := v_confirmed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_confirm] plan % failed: %', v_plan.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('auto_confirmed', v_confirmed_count);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_auto_confirm_meetups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_auto_confirm_meetups() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_auto_confirm_meetups() TO postgres;

CREATE OR REPLACE FUNCTION public.sweep_disbursement_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_r7 INT := 0;
  v_r20 INT := 0;
  v_r28 INT := 0;
BEGIN
  FOR v_item IN
    SELECT q.id, q.user_id, q.amount_cents, q.disburse_after
    FROM public.wallet_disbursement_queue q
    WHERE q.status = 'pending'
      AND q.reminder_7_sent_at IS NULL
      AND q.created_at < NOW() - INTERVAL '7 days'
  LOOP
    PERFORM public.create_notification(
      v_item.user_id,
      'disbursement_reminder',
      'Your funds are waiting',
      'Add your bank account to receive your meetup funds.',
      jsonb_build_object('href', '/wallet', 'amount_cents', v_item.amount_cents),
      'medium',
      'disburse_r7:' || v_item.id::text
    );
    UPDATE public.wallet_disbursement_queue
    SET reminder_7_sent_at = NOW(), updated_at = NOW()
    WHERE id = v_item.id;
    v_r7 := v_r7 + 1;
  END LOOP;

  FOR v_item IN
    SELECT q.id, q.user_id, q.amount_cents, q.disburse_after
    FROM public.wallet_disbursement_queue q
    WHERE q.status = 'pending'
      AND q.reminder_20_sent_at IS NULL
      AND q.created_at < NOW() - INTERVAL '20 days'
  LOOP
    PERFORM public.create_notification(
      v_item.user_id,
      'disbursement_reminder_urgent',
      'Your funds will be sent in 10 days',
      'Add your bank account now so we know where to send your meetup funds.',
      jsonb_build_object('href', '/wallet', 'amount_cents', v_item.amount_cents),
      'high',
      'disburse_r20:' || v_item.id::text
    );
    UPDATE public.wallet_disbursement_queue
    SET reminder_20_sent_at = NOW(), updated_at = NOW()
    WHERE id = v_item.id;
    v_r20 := v_r20 + 1;
  END LOOP;

  FOR v_item IN
    SELECT q.id, q.user_id, q.amount_cents, q.disburse_after
    FROM public.wallet_disbursement_queue q
    WHERE q.status = 'pending'
      AND q.reminder_28_sent_at IS NULL
      AND q.created_at < NOW() - INTERVAL '28 days'
  LOOP
    PERFORM public.create_notification(
      v_item.user_id,
      'disbursement_final_warning',
      '2 days left to add your bank account',
      'Your meetup funds will be sent automatically in 2 days. Add your bank account now.',
      jsonb_build_object('href', '/wallet', 'amount_cents', v_item.amount_cents),
      'high',
      'disburse_r28:' || v_item.id::text
    );
    UPDATE public.wallet_disbursement_queue
    SET reminder_28_sent_at = NOW(), updated_at = NOW()
    WHERE id = v_item.id;
    v_r28 := v_r28 + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'day7_sent', v_r7, 'day20_sent', v_r20, 'day28_sent', v_r28
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_disbursement_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_disbursement_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_disbursement_reminders() TO postgres;

CREATE OR REPLACE FUNCTION public.sweep_auto_disburse()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_account RECORD;
  v_escalated INT := 0;
BEGIN
  FOR v_item IN
    SELECT q.id, q.user_id, q.amount_cents, q.source_wallet_ledger_id
    FROM public.wallet_disbursement_queue q
    WHERE q.status = 'pending'
      AND q.disburse_after <= NOW()
  LOOP
    SELECT * INTO v_account
    FROM public.user_payment_accounts
    WHERE user_id = v_item.user_id
      AND is_default = TRUE
    LIMIT 1;

    IF FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.unclaimed_funds (
      user_id, amount_cents, source_wallet_ledger_id,
      reason, status, escalated_at
    ) VALUES (
      v_item.user_id, v_item.amount_cents, v_item.source_wallet_ledger_id,
      'no_bank_account', 'admin_review', NOW()
    );

    UPDATE public.wallet_disbursement_queue
    SET status = 'unclaimed', updated_at = NOW()
    WHERE id = v_item.id;

    PERFORM public.create_notification(
      v_item.user_id,
      'disbursement_escalated',
      'Add your bank account to receive your funds',
      'Your meetup funds could not be sent automatically. Add your bank account to receive them.',
      jsonb_build_object('href', '/wallet'),
      'high',
      'disburse_escalate:' || v_item.id::text
    );

    v_escalated := v_escalated + 1;
  END LOOP;

  RETURN jsonb_build_object('escalated', v_escalated);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_auto_disburse() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_auto_disburse() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_auto_disburse() TO postgres;

CREATE OR REPLACE FUNCTION public.sweep_unclaimed_funds()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
  UPDATE public.unclaimed_funds
  SET status = 'written_off', updated_at = NOW()
  WHERE status = 'admin_review'
    AND escalated_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('written_off', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_unclaimed_funds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_unclaimed_funds() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_unclaimed_funds() TO postgres;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-auto-confirm-meetups') THEN
      PERFORM cron.unschedule('sweep-auto-confirm-meetups');
    END IF;
    PERFORM cron.schedule(
      'sweep-auto-confirm-meetups',
      '0 * * * *',
      $$SELECT public.sweep_auto_confirm_meetups()$$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-disbursement-reminders') THEN
      PERFORM cron.unschedule('sweep-disbursement-reminders');
    END IF;
    PERFORM cron.schedule(
      'sweep-disbursement-reminders',
      '0 8 * * *',
      $$SELECT public.sweep_disbursement_reminders()$$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-auto-disburse') THEN
      PERFORM cron.unschedule('sweep-auto-disburse');
    END IF;
    PERFORM cron.schedule(
      'sweep-auto-disburse',
      '0 10 * * *',
      $$SELECT public.sweep_auto_disburse()$$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-unclaimed-funds') THEN
      PERFORM cron.unschedule('sweep-unclaimed-funds');
    END IF;
    PERFORM cron.schedule(
      'sweep-unclaimed-funds',
      '0 0 * * 0',
      $$SELECT public.sweep_unclaimed_funds()$$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'disbursement-sweep') THEN
      PERFORM cron.unschedule('disbursement-sweep');
    END IF;
    PERFORM cron.schedule(
      'disbursement-sweep',
      '15 10 * * *',
      $job$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/disbursement-sweep',
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

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_disbursement_queue;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.disbursement_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
