/**
 * KYC — verification_requests columns + RLS: only verified users create plans,
 * submit offers (negotiation), or open escrow rows.
 */
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS country_code TEXT;

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Replace INSERT policies (trust-gated features)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS plans_insert ON public.plans;
CREATE POLICY plans_insert ON public.plans FOR INSERT
WITH CHECK (
  auth.uid() = creator_id
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS offers_insert ON public.plan_offers;
CREATE POLICY offers_insert ON public.plan_offers FOR INSERT
WITH CHECK (
  auth.uid() = bidder_id
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS escrow_insert ON public.escrow_transactions;
CREATE POLICY escrow_insert ON public.escrow_transactions FOR INSERT
WITH CHECK (
  (auth.uid() = payer_id OR auth.uid() = payee_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.verification_status = 'verified'
  )
);
