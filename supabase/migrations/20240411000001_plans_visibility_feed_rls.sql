/**
 * Allow radius (and keep public) plans discoverable in feed for signed-in users.
 * Friends-only remains visible only to host + offer participants via existing branches.
 */
DROP POLICY IF EXISTS plans_select ON public.plans;

CREATE POLICY plans_select ON public.plans FOR SELECT
  USING (
    creator_id = auth.uid()
    OR visibility IN ('public', 'radius')
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.plan_offers o WHERE o.plan_id = plans.id AND o.bidder_id = auth.uid()
    )
  );
