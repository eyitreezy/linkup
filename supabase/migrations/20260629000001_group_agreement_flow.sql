-- Group plan agreement: per-slot confirmation + guest resolution for escrow checks.
-- 1:1 behaviour unchanged when p_offer_id is omitted.

DROP FUNCTION IF EXISTS public.record_agreement_confirmation(UUID);

CREATE OR REPLACE FUNCTION public.escrow_agreement_confirmations_met(p_plan_id UUID, p_guest_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_guest UUID;
  v_n INT;
BEGIN
  SELECT p.creator_id INTO v_creator
  FROM public.plans p
  WHERE p.id = p_plan_id;

  IF v_creator IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_guest_id IS NOT NULL THEN
    v_guest := p_guest_id;
  ELSE
    SELECT o.bidder_id INTO v_guest
    FROM public.plans p
    LEFT JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.id = p_plan_id;
  END IF;

  IF v_guest IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(DISTINCT ac.user_id)::INT
  INTO v_n
  FROM public.agreement_confirmations ac
  WHERE ac.plan_id = p_plan_id
    AND ac.user_id IN (v_creator, v_guest);

  RETURN COALESCE(v_n, 0) >= 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_agreement_confirmation(
  p_plan_id UUID,
  p_offer_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_offer public.plan_offers%ROWTYPE;
  v_other UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF COALESCE(v_plan.is_group_plan, false) AND p_offer_id IS NOT NULL THEN
    SELECT * INTO v_offer
    FROM public.plan_offers
    WHERE id = p_offer_id
      AND plan_id = p_plan_id
      AND status = 'accepted'::public.offer_status;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_eligible';
    END IF;

    IF auth.uid() NOT IN (v_plan.creator_id, v_offer.bidder_id) THEN
      RAISE EXCEPTION 'not_eligible';
    END IF;

    v_other := CASE
      WHEN v_plan.creator_id = auth.uid() THEN v_offer.bidder_id
      ELSE v_plan.creator_id
    END;
  ELSE
    SELECT CASE WHEN p.creator_id = auth.uid() THEN o.bidder_id ELSE p.creator_id END
    INTO v_other
    FROM public.plans p
    JOIN public.plan_offers o ON o.id = p.accepted_offer_id
    WHERE p.id = p_plan_id
      AND p.status = 'agreed'::public.plan_status
      AND (p.creator_id = auth.uid() OR o.bidder_id = auth.uid());

    IF v_other IS NULL THEN
      RAISE EXCEPTION 'not_eligible';
    END IF;
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

REVOKE ALL ON FUNCTION public.record_agreement_confirmation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_agreement_confirmation(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
