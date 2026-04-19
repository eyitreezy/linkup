-- PL6a (part 2/2): agreed-term columns + RLS (runs after enum is committed).

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS agreed_price_cents INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS agreed_scheduled_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS agreed_location TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS agreed_notes TEXT;

DROP POLICY IF EXISTS plans_update_accepted_bidder ON public.plans;
CREATE POLICY plans_update_accepted_bidder ON public.plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.plan_offers o
      WHERE o.plan_id = plans.id
        AND o.bidder_id = auth.uid()
        AND o.status = 'accepted'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plan_offers o
      WHERE o.plan_id = plans.id
        AND o.bidder_id = auth.uid()
        AND o.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS offers_update_bidder_accepted ON public.plan_offers;
CREATE POLICY offers_update_bidder_accepted ON public.plan_offers FOR UPDATE
  USING (
    bidder_id = auth.uid()
    AND status = 'accepted'
    AND EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_offers.plan_id
        AND p.accepted_offer_id = plan_offers.id
        AND p.status IN ('agreed', 'awaiting_payment')
    )
  )
  WITH CHECK (bidder_id = auth.uid());
