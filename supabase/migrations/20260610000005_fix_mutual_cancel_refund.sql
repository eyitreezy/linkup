-- Pattern-aware mutual cancel refunds (A/B/C)

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
  v_pattern TEXT;
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
  v_pattern := COALESCE(v_escrow.escrow_pattern::text, v_plan.escrow_pattern::text, 'A');

  INSERT INTO public.cancellations (plan_id, user_id, role, cancel_type, refund_amount, fee_amount, goodwill_credit_amount)
  VALUES
    (p_plan_id, v_plan.creator_id, 'host', 'mutual', 0, 0, 0),
    (p_plan_id, v_offer.bidder_id, 'guest', 'mutual', 0, 0, 0);

  UPDATE public.plan_offers SET status = 'declined' WHERE id = v_offer.id;
  UPDATE public.plans SET status = 'cancelled' WHERE id = p_plan_id;
  DELETE FROM public.mutual_plan_cancel_votes WHERE plan_id = p_plan_id;

  IF v_escrow.id IS NOT NULL AND v_escrow.status IN ('funded', 'active') THEN
    UPDATE public.escrow_transactions SET status = 'refunded', updated_at = now() WHERE id = v_escrow.id;

    IF v_pattern = 'A' THEN
      IF v_total > 0 AND v_escrow.payer_id IS NOT NULL THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.payer_id,
          v_total,
          'refund',
          v_escrow.id::text || ':mutual',
          jsonb_build_object('plan_id', p_plan_id, 'mutual', true, 'pattern', 'A')
        );
      END IF;
    ELSIF v_pattern = 'B' THEN
      IF v_escrow.host_funded_at IS NOT NULL AND COALESCE(v_escrow.host_share_cents, 0) > 0 THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.host_id,
          v_escrow.host_share_cents,
          'refund',
          v_escrow.id::text || ':mutual_host',
          jsonb_build_object('plan_id', p_plan_id, 'mutual', true, 'pattern', 'B', 'leg', 'host')
        );
      END IF;
      IF v_escrow.guest_funded_at IS NOT NULL AND COALESCE(v_escrow.guest_share_cents, 0) > 0 THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.guest_id,
          v_escrow.guest_share_cents,
          'refund',
          v_escrow.id::text || ':mutual_guest',
          jsonb_build_object('plan_id', p_plan_id, 'mutual', true, 'pattern', 'B', 'leg', 'guest')
        );
      END IF;
    ELSIF v_pattern = 'C' THEN
      IF v_total > 0 AND v_escrow.payer_id IS NOT NULL THEN
        PERFORM public._wallet_credit_internal(
          v_escrow.payer_id,
          v_total,
          'refund',
          v_escrow.id::text || ':mutual',
          jsonb_build_object('plan_id', p_plan_id, 'mutual', true, 'pattern', 'C')
        );
      END IF;
    END IF;

    PERFORM public.append_financial_event(
      v_escrow.payer_id,
      'escrow_refunded',
      v_total,
      'escrow:' || v_escrow.id::text || ':mutual',
      jsonb_build_object('plan_id', p_plan_id, 'mutual', true, 'pattern', v_pattern)
    );
  ELSIF v_escrow.id IS NOT NULL THEN
    UPDATE public.escrow_transactions SET status = 'cancelled', updated_at = now() WHERE id = v_escrow.id;
  END IF;

  PERFORM public.append_financial_event(
    v_escrow.payer_id,
    'cancellation',
    v_total,
    'mutual_cancel:' || p_plan_id::text,
    jsonb_build_object('mutual', true, 'pattern', v_pattern)
  );

  RETURN jsonb_build_object('status', 'completed', 'refund_amount', v_total, 'pattern', v_pattern);
END;
$$;

REVOKE ALL ON FUNCTION public.vote_mutual_plan_cancel(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_mutual_plan_cancel(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
