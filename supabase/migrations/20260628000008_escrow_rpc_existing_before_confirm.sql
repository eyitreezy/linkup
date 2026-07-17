-- Return existing escrow before re-checking agreement confirmations (fund-your-share retries).

CREATE OR REPLACE FUNCTION public.create_plan_escrow_transaction(
  p_plan_id UUID,
  p_offer_id UUID,
  p_payer_id UUID,
  p_payee_id UUID,
  p_host_id UUID,
  p_guest_id UUID,
  p_amount_cents INT,
  p_host_share_cents INT,
  p_guest_share_cents INT,
  p_escrow_pattern TEXT,
  p_currency TEXT,
  p_funding_deadline TIMESTAMPTZ,
  p_group_plan_index INT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
  v_is_group BOOLEAN;
  v_existing UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_actor NOT IN (p_payer_id, p_payee_id, p_host_id, p_guest_id) THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_actor AND u.verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'verification_required';
  END IF;

  SELECT p.is_group_plan INTO v_is_group FROM public.plans p WHERE p.id = p_plan_id;

  IF v_is_group THEN
    SELECT e.id INTO v_existing
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id AND e.guest_id = p_guest_id
    LIMIT 1;
  ELSE
    SELECT e.id INTO v_existing
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE public.plans
    SET status = CASE
      WHEN v_is_group THEN 'negotiating'::public.plan_status
      ELSE 'awaiting_payment'::public.plan_status
    END
    WHERE id = p_plan_id AND status = 'agreed'::public.plan_status;
    RETURN v_existing;
  END IF;

  IF NOT public.escrow_agreement_confirmations_met(p_plan_id, p_guest_id) THEN
    RAISE EXCEPTION 'both_parties_must_confirm';
  END IF;

  INSERT INTO public.escrow_transactions (
    plan_id,
    payer_id,
    payee_id,
    host_id,
    guest_id,
    offer_id,
    group_plan_index,
    escrow_pattern,
    amount_cents,
    host_share_cents,
    guest_share_cents,
    funding_deadline,
    currency,
    status,
    metadata
  )
  VALUES (
    p_plan_id,
    p_payer_id,
    p_payee_id,
    p_host_id,
    p_guest_id,
    p_offer_id,
    p_group_plan_index,
    p_escrow_pattern,
    p_amount_cents,
    p_host_share_cents,
    p_guest_share_cents,
    p_funding_deadline,
    COALESCE(p_currency, 'NGN'),
    'pending_funding'::public.escrow_status,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  UPDATE public.plans
  SET status = CASE
    WHEN v_is_group THEN 'negotiating'::public.plan_status
    ELSE 'awaiting_payment'::public.plan_status
  END
  WHERE id = p_plan_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_plan_escrow_transaction(
  UUID, UUID, UUID, UUID, UUID, UUID, INT, INT, INT, TEXT, TEXT, TIMESTAMPTZ, INT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_plan_escrow_transaction(
  UUID, UUID, UUID, UUID, UUID, UUID, INT, INT, INT, TEXT, TEXT, TIMESTAMPTZ, INT, JSONB
) TO authenticated;

NOTIFY pgrst, 'reload schema';
