-- Goodwill fee offset, expiry sweep, admin issuance (Parts 1, 6, 8, 9)

-- ---------------------------------------------------------------------------
-- wallet_ledger: display-only goodwill application rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS is_display_only BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- escrow_transactions: audit goodwill offset on release
-- ---------------------------------------------------------------------------
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS goodwill_applied_cents INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- FIFO goodwill → platform fee offset
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_goodwill_to_fee(
  p_user_id UUID,
  p_fee_cents BIGINT,
  p_reference TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_remaining BIGINT := GREATEST(0, COALESCE(p_fee_cents, 0));
  v_applied_total BIGINT := 0;
  v_available BIGINT;
  v_apply_now BIGINT;
BEGIN
  IF p_user_id IS NULL OR v_remaining <= 0 THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT id, amount, used_amount, expires_at
    FROM public.goodwill_credits
    WHERE user_id = p_user_id
      AND expires_at > now()
      AND used_amount < amount
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_available := v_row.amount - v_row.used_amount;
    v_apply_now := LEAST(v_available, v_remaining);

    UPDATE public.goodwill_credits
    SET used_amount = used_amount + v_apply_now::INT
    WHERE id = v_row.id;

    v_applied_total := v_applied_total + v_apply_now;
    v_remaining := v_remaining - v_apply_now;
  END LOOP;

  IF v_applied_total > 0 THEN
    INSERT INTO public.wallet_ledger (user_id, type, source, amount, reference_id, is_display_only)
    VALUES (p_user_id, 'credit', 'goodwill', v_applied_total::INT, p_reference, TRUE);

    PERFORM public.append_financial_event(
      p_user_id,
      'goodwill_applied',
      v_applied_total::INT,
      'goodwill_applied:' || COALESCE(p_reference, gen_random_uuid()::text),
      jsonb_build_object('reference', p_reference)
    );
  END IF;

  RETURN v_applied_total;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_goodwill_to_fee(UUID, BIGINT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- _escrow_release_internal — apply goodwill before payee credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._escrow_release_internal(
  p_escrow_id UUID,
  p_auto_released BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_full_fee INT;
  v_goodwill_applied INT := 0;
  v_net_fee INT;
  v_net INT;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE id = p_escrow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_not_found';
  END IF;

  IF v_escrow.status = 'released' THEN
    RETURN jsonb_build_object('status', 'already_released', 'escrow_id', p_escrow_id);
  END IF;

  IF v_escrow.status = 'disputed' THEN
    RAISE EXCEPTION 'escrow_disputed';
  END IF;

  IF v_escrow.status NOT IN ('funded', 'active') THEN
    RAISE EXCEPTION 'escrow_not_releasable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.escrow_disputes d
    WHERE d.escrow_id = p_escrow_id
      AND d.status IN ('open', 'under_review')
  ) THEN
    RAISE EXCEPTION 'escrow_dispute_open';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_escrow.plan_id;
  IF v_plan.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'plan_not_completed';
  END IF;

  v_full_fee := public.platform_fee_cents_for_amount(v_escrow.amount_cents);

  IF v_escrow.payee_id IS NOT NULL AND v_full_fee > 0 THEN
    v_goodwill_applied := public._apply_goodwill_to_fee(
      v_escrow.payee_id,
      v_full_fee,
      v_escrow.id::text || CASE WHEN p_auto_released THEN ':auto' ELSE ':manual' END
    )::INT;
  END IF;

  v_net_fee := GREATEST(0, v_full_fee - v_goodwill_applied);
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_net_fee);
  v_ref := v_escrow.id::text || CASE WHEN p_auto_released THEN ':auto' ELSE ':manual' END;

  IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
    PERFORM public._wallet_credit_internal(
      v_escrow.payee_id,
      v_net,
      'escrow_release',
      v_ref,
      jsonb_build_object(
        'plan_id', v_escrow.plan_id,
        'platform_fee_cents', v_net_fee,
        'platform_fee_full_cents', v_full_fee,
        'goodwill_applied_cents', v_goodwill_applied,
        'escrow_pattern', v_escrow.escrow_pattern,
        'auto_released', p_auto_released
      )
    );
  END IF;

  UPDATE public.escrow_transactions
  SET
    status = 'released',
    released_at = now(),
    platform_fee_cents = v_net_fee,
    goodwill_applied_cents = v_goodwill_applied,
    metadata = COALESCE(metadata, '{}'::jsonb) || CASE
      WHEN p_auto_released THEN jsonb_build_object('auto_released', true)
      ELSE '{}'::jsonb
    END,
    updated_at = now()
  WHERE id = p_escrow_id;

  RETURN jsonb_build_object(
    'status', 'released',
    'escrow_id', p_escrow_id,
    'net_amount_cents', v_net,
    'platform_fee_cents', v_net_fee,
    'platform_fee_full_cents', v_full_fee,
    'goodwill_applied_cents', v_goodwill_applied,
    'payee_id', v_escrow.payee_id,
    'auto_released', p_auto_released
  );
END;
$$;

REVOKE ALL ON FUNCTION public._escrow_release_internal(UUID, BOOLEAN) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- admin_resolve_escrow_dispute — goodwill offset on release / split payee leg
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
  v_full_fee INT;
  v_goodwill_applied INT := 0;
  v_net_fee INT;
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

  v_full_fee := public.platform_fee_cents_for_amount(v_escrow.amount_cents);
  v_ref := v_escrow.id::text || ':admin:' || p_decision;

  IF p_decision IN ('release', 'split') AND v_escrow.payee_id IS NOT NULL AND v_full_fee > 0 THEN
    v_goodwill_applied := public._apply_goodwill_to_fee(
      v_escrow.payee_id,
      v_full_fee,
      v_ref || ':goodwill'
    )::INT;
  END IF;

  v_net_fee := GREATEST(0, v_full_fee - v_goodwill_applied);
  v_net := GREATEST(0, COALESCE(v_escrow.amount_cents, 0) - v_net_fee);

  IF p_decision = 'release' THEN
    IF v_net > 0 AND v_escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payee_id,
        v_net,
        'escrow_release',
        v_ref,
        jsonb_build_object(
          'escrow_dispute_id', p_dispute_id,
          'plan_id', v_escrow.plan_id,
          'platform_fee_cents', v_net_fee,
          'goodwill_applied_cents', v_goodwill_applied
        )
      );
    END IF;
    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = now(),
      platform_fee_cents = v_net_fee,
      goodwill_applied_cents = v_goodwill_applied,
      updated_at = now()
    WHERE id = v_escrow.id;

  ELSIF p_decision = 'refund' THEN
    IF v_escrow.amount_cents > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_escrow.amount_cents,
        'refund',
        v_ref,
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'plan_id', v_escrow.plan_id)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET status = 'refunded', released_at = now(), updated_at = now()
    WHERE id = v_escrow.id;

  ELSIF p_decision = 'split' THEN
    v_payee_amount := ROUND((v_net::numeric * p_split_bps) / 10000.0)::INT;
    v_payer_amount := GREATEST(0, v_escrow.amount_cents - v_payee_amount - v_net_fee);
    IF v_payee_amount > 0 AND v_escrow.payee_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payee_id,
        v_payee_amount,
        'escrow_release',
        v_ref || ':payee',
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'split_bps', p_split_bps)
      );
    END IF;
    IF v_payer_amount > 0 AND v_escrow.payer_id IS NOT NULL THEN
      PERFORM public._wallet_credit_internal(
        v_escrow.payer_id,
        v_payer_amount,
        'refund',
        v_ref || ':payer',
        jsonb_build_object('escrow_dispute_id', p_dispute_id, 'split_bps', p_split_bps)
      );
    END IF;
    UPDATE public.escrow_transactions
    SET
      status = 'released',
      released_at = now(),
      platform_fee_cents = v_net_fee,
      goodwill_applied_cents = v_goodwill_applied,
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
      'escrow_id', v_escrow.id,
      'goodwill_applied_cents', v_goodwill_applied
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_escrow_dispute(UUID, TEXT, INT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_escrow_dispute(UUID, TEXT, INT, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- _goodwill_issue_internal — richer notification payload
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._goodwill_issue_internal(
  p_user_id UUID,
  p_amount INT,
  p_source TEXT,
  p_reference TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_body TEXT;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  SELECT COALESCE(subscription_tier, 'FREE') INTO v_tier FROM public.users WHERE id = p_user_id;
  INSERT INTO public.goodwill_credits (user_id, amount, source, expires_at, tier_at_award)
  VALUES (p_user_id, p_amount, p_source, now() + interval '60 days', v_tier);
  PERFORM public.append_financial_event(
    p_user_id,
    'goodwill_issued',
    p_amount,
    'goodwill:' || COALESCE(p_reference, gen_random_uuid()::text),
    jsonb_build_object('source', p_source, 'tier_at_award', v_tier)
  );
  v_body := format(
    'You received a %s goodwill credit. It will automatically reduce platform fees on future escrows.',
    to_char(p_amount / 100.0, 'FM₦999,999,990.00')
  );
  PERFORM public.create_notification(
    p_user_id,
    'credit_issued',
    'Goodwill credit issued',
    v_body,
    jsonb_build_object('href', '/(tabs)/wallet', 'amountCents', p_amount),
    'medium',
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public._goodwill_issue_internal(UUID, INT, TEXT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Expiry warning sweep (7 days before expiry)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expiring_goodwill_credits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INT := 0;
  v_body TEXT;
BEGIN
  FOR v_row IN
    SELECT id, user_id, (amount - used_amount) AS remaining, expires_at
    FROM public.goodwill_credits
    WHERE expires_at::date = (now() + interval '7 days')::date
      AND used_amount < amount
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.financial_events fe
      WHERE fe.event_type = 'goodwill_expiry_warning'
        AND fe.reference_id = v_row.id::text
    ) THEN
      CONTINUE;
    END IF;

    v_body := format(
      'Your %s goodwill credit expires in 7 days. It automatically applies to platform fees — use it before it expires.',
      to_char(v_row.remaining / 100.0, 'FM₦999,999,990.00')
    );

    PERFORM public.create_notification(
      v_row.user_id,
      'credit_expiring',
      'Goodwill credit expiring soon',
      v_body,
      jsonb_build_object('href', '/(tabs)/wallet'),
      'medium',
      'goodwill_expiry:' || v_row.id::text
    );

    PERFORM public.append_financial_event(
      v_row.user_id,
      'goodwill_expiry_warning',
      v_row.remaining::INT,
      v_row.id::text,
      jsonb_build_object('expires_at', v_row.expires_at)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('notified', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_expiring_goodwill_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_expiring_goodwill_credits() TO service_role;

-- ---------------------------------------------------------------------------
-- Admin issue goodwill (promo / dispute_resolution)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_issue_goodwill_credit(
  p_user_id UUID,
  p_amount_cents INT,
  p_source TEXT DEFAULT 'promo',
  p_expires_days INT DEFAULT 60,
  p_admin_note TEXT DEFAULT NULL,
  p_dispute_id UUID DEFAULT NULL,
  p_admin_id UUID DEFAULT auth.uid()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_id UUID;
  v_tier TEXT;
  v_body TEXT;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_source NOT IN ('promo', 'dispute_resolution') THEN
    RAISE EXCEPTION 'invalid_source';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT COALESCE(subscription_tier, 'FREE') INTO v_tier FROM public.users WHERE id = p_user_id;

  INSERT INTO public.goodwill_credits (
    user_id, amount, used_amount, source, tier_at_award, expires_at
  ) VALUES (
    p_user_id,
    p_amount_cents,
    0,
    p_source,
    v_tier,
    now() + (GREATEST(1, p_expires_days) || ' days')::interval
  ) RETURNING id INTO v_credit_id;

  PERFORM public.append_financial_event(
    p_user_id,
    'goodwill_issued',
    p_amount_cents,
    'goodwill_admin:' || v_credit_id::text,
    jsonb_build_object(
      'source', p_source,
      'admin_id', p_admin_id,
      'admin_note', p_admin_note,
      'tier_at_award', v_tier
    )
  );

  v_body := format(
    'You received a %s goodwill credit%s.',
    to_char(p_amount_cents / 100.0, 'FM₦999,999,990.00'),
    CASE WHEN p_admin_note IS NOT NULL AND length(trim(p_admin_note)) > 0 THEN ': ' || p_admin_note ELSE '' END
  );

  PERFORM public.create_notification(
    p_user_id,
    'credit_issued',
    'Goodwill credit issued',
    v_body,
    jsonb_build_object('href', '/(tabs)/wallet', 'amountCents', p_amount_cents),
    'medium',
    NULL
  );

  IF p_dispute_id IS NOT NULL THEN
    INSERT INTO public.dispute_admin_actions (dispute_id, admin_user_id, action, detail)
    VALUES (
      p_dispute_id,
      p_admin_id,
      'goodwill_issued_' || p_source,
      jsonb_build_object(
        'goodwill_credit_id', v_credit_id,
        'amount_cents', p_amount_cents,
        'user_id', p_user_id,
        'note', p_admin_note
      )
    );
  END IF;

  RETURN v_credit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_issue_goodwill_credit(UUID, INT, TEXT, INT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_issue_goodwill_credit(UUID, INT, TEXT, INT, TEXT, UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cron: goodwill expiry sweep (daily 09:00 UTC)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'goodwill-expiry-sweep') THEN
      PERFORM cron.unschedule('goodwill-expiry-sweep');
    END IF;
    PERFORM cron.schedule(
      'goodwill-expiry-sweep',
      '0 9 * * *',
      $job$
      SELECT net.http_post(
        url := coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1),
          'https://othikifibhjpfgyxpzcu.supabase.co'
        ) || '/functions/v1/goodwill-expiry-sweep',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  END IF;
END;
$cron$;

NOTIFY pgrst, 'reload schema';
