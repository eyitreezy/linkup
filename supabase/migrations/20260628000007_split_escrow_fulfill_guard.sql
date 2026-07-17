-- Prevent fulfill_escrow_from_flutterwave from full-funding split (pattern B) escrows.
-- Pattern B must fund host/guest legs individually via processEscrowCharge.

CREATE OR REPLACE FUNCTION public.fulfill_escrow_from_flutterwave(
  p_escrow_id uuid,
  p_reference text,
  p_flw_tx_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.escrow_transactions%ROWTYPE;
  v_now timestamptz := now();
  v_meta jsonb;
  v_status text;
BEGIN
  SELECT * INTO v_row
  FROM public.escrow_transactions
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'escrow_not_found');
  END IF;

  IF v_row.escrow_pattern = 'B' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'split_requires_leg');
  END IF;

  v_status := v_row.status::text;
  IF v_status <> 'pending_funding' THEN
    IF v_status IN ('funded', 'active', 'released') THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_status);
  END IF;

  v_meta := COALESCE(v_row.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb);

  UPDATE public.escrow_transactions
  SET
    status = 'funded',
    funded_at = v_now,
    paystack_reference = p_reference,
    payment_tx_ref = COALESCE(payment_tx_ref, p_reference),
    flutterwave_transaction_id = COALESCE(NULLIF(p_flw_tx_id, ''), flutterwave_transaction_id),
    metadata = v_meta,
    updated_at = v_now
  WHERE id = p_escrow_id;

  RETURN jsonb_build_object('ok', true, 'funded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_escrow_from_flutterwave(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_escrow_from_flutterwave(uuid, text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
