-- Annexure B follow-up: exigency financial settlement + guest confirm release.
-- Settles the reporter's per-guest escrow row (group multi-escrow).

-- -----------------------------------------------------------------------------
-- Queue a wallet ledger credit for bank disbursement by reference_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._queue_wallet_credit_by_reference(p_reference TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RETURN;
  END IF;

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
    AND wl.reference_id = p_reference
  ORDER BY wl.created_at DESC
  LIMIT 1
  ON CONFLICT (source_wallet_ledger_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._queue_wallet_credit_by_reference(TEXT) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- Apply exigency cash settlement for one report
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_exigency_escrow_settlement(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.exigency_reports%ROWTYPE;
  v_escrow public.escrow_transactions%ROWTYPE;
  v_full_fee INT;
  v_net INT;
  v_guest_amt INT;
  v_host_amt INT;
  v_ref TEXT;
  v_host_ref TEXT;
  v_guest_ref TEXT;
  v_goodwill_base INT;
  v_goodwill INT;
  v_refund_pct INT;
  v_host_pct INT;
BEGIN
  SELECT * INTO v_report
  FROM public.exigency_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_not_found';
  END IF;

  IF v_report.refund_processed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'report_id', p_report_id
    );
  END IF;

  IF v_report.outcome = 'pending_review' THEN
    RAISE EXCEPTION 'outcome_still_pending';
  END IF;

  -- Per-guest escrow row for the non-confirming member
  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE plan_id = v_report.plan_id
    AND guest_id = v_report.user_id
    AND status IN ('funded', 'active')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No funded escrow for this guest (free slot / already settled)
    UPDATE public.exigency_reports
    SET refund_processed_at = NOW()
    WHERE id = p_report_id;

    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'reason', 'escrow_not_found',
      'report_id', p_report_id
    );
  END IF;

  v_refund_pct := COALESCE(v_report.refund_percent, 0);
  v_host_pct := COALESCE(v_report.host_percent, 0);

  IF v_report.outcome = 'force_majeure_approved' THEN
    v_refund_pct := 100;
    v_host_pct := 0;
  ELSIF v_report.outcome = 'late_arrival_confirmed' THEN
    v_refund_pct := 0;
    v_host_pct := 100;
  ELSIF v_report.outcome = 'no_report_auto' THEN
    v_refund_pct := 50;
    v_host_pct := 50;
  ELSIF v_report.outcome = 'unsatisfactory' THEN
    v_refund_pct := 70;
    v_host_pct := 30;
  ELSIF v_report.outcome = 'fairly_satisfactory' THEN
    v_refund_pct := 80;
    v_host_pct := 20;
  END IF;

  IF v_refund_pct + v_host_pct <> 100 THEN
    RAISE EXCEPTION 'invalid_split_percents';
  END IF;

  v_full_fee := public.fee_from_gross_amount_cents(v_escrow.amount_cents)::INT;
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_full_fee);
  v_guest_amt := ROUND((v_net::numeric * v_refund_pct) / 100.0)::INT;
  v_host_amt := GREATEST(0, v_net - v_guest_amt);

  v_ref := v_escrow.id::text || ':exigency:' || p_report_id::text;
  v_host_ref := v_ref || ':host';
  v_guest_ref := v_ref || ':guest';

  IF v_guest_amt > 0 AND v_escrow.payer_id IS NOT NULL THEN
    PERFORM public._wallet_credit_internal(
      v_escrow.payer_id,
      v_guest_amt,
      'refund',
      v_guest_ref,
      jsonb_build_object(
        'exigency_report_id', p_report_id,
        'plan_id', v_escrow.plan_id,
        'outcome', v_report.outcome::text,
        'platform_fee_cents', v_full_fee
      )
    );
  END IF;

  IF v_host_amt > 0 AND v_escrow.payee_id IS NOT NULL THEN
    PERFORM public._wallet_credit_internal(
      v_escrow.payee_id,
      v_host_amt,
      'escrow_release',
      v_host_ref,
      jsonb_build_object(
        'exigency_report_id', p_report_id,
        'plan_id', v_escrow.plan_id,
        'outcome', v_report.outcome::text,
        'platform_fee_cents', v_full_fee
      )
    );
    PERFORM public._queue_wallet_credit_by_reference(v_host_ref);
  END IF;

  -- Outcome 2: Goodwill Credits to Host (platform fee retained; guest already got net)
  IF v_report.outcome = 'force_majeure_approved' AND v_escrow.payee_id IS NOT NULL THEN
    v_goodwill_base := LEAST(
      3000,
      GREATEST(200, FLOOR(v_net * 0.08)::INT)
    );
    v_goodwill := public.goodwill_credit_amount(v_escrow.payee_id, v_goodwill_base);
    PERFORM public._goodwill_issue_internal(
      v_escrow.payee_id,
      v_goodwill,
      'dispute_resolution',
      v_ref || ':goodwill'
    );
  END IF;

  UPDATE public.escrow_transactions
  SET
    status = CASE
      WHEN v_host_amt <= 0 AND v_guest_amt > 0 THEN 'refunded'
      ELSE 'released'
    END,
    released_at = NOW(),
    platform_fee_cents = v_full_fee,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'exigency_report_id', p_report_id,
      'exigency_outcome', v_report.outcome::text,
      'guest_refund_cents', v_guest_amt,
      'host_release_cents', v_host_amt
    )
  WHERE id = v_escrow.id;

  UPDATE public.exigency_reports
  SET
    refund_percent = v_refund_pct,
    host_percent = v_host_pct,
    refund_processed_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'escrow_id', v_escrow.id,
    'guest_refund_cents', v_guest_amt,
    'host_release_cents', v_host_amt,
    'platform_fee_cents', v_full_fee,
    'goodwill_cents', COALESCE(v_goodwill, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._apply_exigency_escrow_settlement(UUID) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- Replace admin_apply_exigency_outcome to settle money
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
  _settle JSONB;
BEGIN
  IF _admin IS NULL OR NOT public.is_admin(_admin) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_outcome = 'pending_review' OR p_outcome = 'no_report_auto' THEN
    RAISE EXCEPTION 'invalid_admin_outcome';
  END IF;

  SELECT * INTO _report FROM public.exigency_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found'; END IF;

  IF _report.refund_processed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_settled';
  END IF;

  UPDATE public.exigency_reports
  SET
    outcome = p_outcome,
    refund_percent = p_refund_percent,
    host_percent = p_host_percent,
    reviewed_by = _admin,
    reviewed_at = NOW(),
    review_notes = p_review_notes
  WHERE id = p_report_id;

  _settle := public._apply_exigency_escrow_settlement(p_report_id);

  PERFORM public.create_notification(
    _report.user_id,
    'exigency_outcome_applied',
    'Exigency report reviewed',
    'Your exigency report has been reviewed. Check your wallet for updates.',
    jsonb_build_object('href', '/wallet', 'planId', _report.plan_id::text),
    'high',
    'exigency_outcome:' || p_report_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'settlement', _settle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_exigency_outcome(UUID, public.exigency_outcome, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_exigency_outcome(UUID, public.exigency_outcome, INT, INT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Auto Outcome 3: settle after insert
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
  _report_id UUID;
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
      _report_id := NULL;
      INSERT INTO public.exigency_reports (
        plan_id, user_id, reason_type, reason_text, outcome,
        refund_percent, host_percent, review_deadline_at, reviewed_at
      ) VALUES (
        _plan.id, _guest.bidder_id,
        'other', 'Auto-triggered: no report submitted within 24 hours',
        'no_report_auto', 50, 50,
        NOW(), NOW()
      )
      ON CONFLICT (plan_id, user_id) DO NOTHING
      RETURNING id INTO _report_id;

      IF _report_id IS NOT NULL THEN
        BEGIN
          PERFORM public._apply_exigency_escrow_settlement(_report_id);
        EXCEPTION WHEN OTHERS THEN
          -- Keep report; settlement can be retried by admin
          NULL;
        END;

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
-- Guest attendance confirm: release that guest's escrow to host (full)
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
  _escrow public.escrow_transactions%ROWTYPE;
  _fee INT;
  _net INT;
  _ref TEXT;
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

  -- Release this guest's funded escrow to the host (attendance confirmed)
  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = _user_id
    AND status IN ('funded', 'active')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    _fee := public.fee_from_gross_amount_cents(_escrow.amount_cents)::INT;
    _net := GREATEST(0, COALESCE(_escrow.amount_cents, 0) - _fee);
    _ref := _escrow.id::text || ':group_confirm:' || _user_id::text;

    IF _net > 0 AND _escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        _escrow.payee_id,
        _net,
        'escrow_release',
        _ref,
        jsonb_build_object(
          'plan_id', p_plan_id,
          'guest_id', _user_id,
          'platform_fee_cents', _fee,
          'reason', 'group_guest_confirmed'
        )
      );
      PERFORM public._queue_wallet_credit_by_reference(_ref);
    END IF;

    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = NOW(),
      platform_fee_cents = _fee,
      updated_at = NOW()
    WHERE id = _escrow.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'confirmed_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.submit_group_guest_confirmation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_group_guest_confirmation(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
