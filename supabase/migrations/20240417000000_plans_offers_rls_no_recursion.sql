/**
 * Break RLS recursion between `plans` and `plan_offers` (and related tables):
 * `plans_select` referenced `plan_offers`, while `offers_select` referenced `plans`, causing
 * "infinite recursion detected in policy for relation plans".
 *
 * SECURITY DEFINER helpers read plan columns without re-evaluating RLS.
 */
CREATE OR REPLACE FUNCTION public.plan_creator_id(plan_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT creator_id FROM public.plans WHERE id = plan_id;
$$;

CREATE OR REPLACE FUNCTION public.plan_accepted_offer_id(plan_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT accepted_offer_id FROM public.plans WHERE id = plan_id;
$$;

CREATE OR REPLACE FUNCTION public.plan_row_status(plan_id uuid)
RETURNS public.plan_status
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT status FROM public.plans WHERE id = plan_id;
$$;

REVOKE ALL ON FUNCTION public.plan_creator_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.plan_accepted_offer_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.plan_row_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_creator_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_accepted_offer_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_row_status(uuid) TO authenticated, service_role;

-- plan_offers: avoid subquery on plans (was recursive with plans_select)
DROP POLICY IF EXISTS offers_select ON public.plan_offers;
CREATE POLICY offers_select ON public.plan_offers FOR SELECT
  USING (
    bidder_id = auth.uid()
    OR public.plan_creator_id(plan_id) = auth.uid()
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS offers_update ON public.plan_offers;
CREATE POLICY offers_update ON public.plan_offers FOR UPDATE
  USING (
    public.plan_creator_id(plan_id) = auth.uid()
    OR bidder_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS offers_update_bidder_accepted ON public.plan_offers;
CREATE POLICY offers_update_bidder_accepted ON public.plan_offers FOR UPDATE
  USING (
    bidder_id = auth.uid()
    AND status = 'accepted'
    AND public.plan_accepted_offer_id(plan_offers.plan_id) = plan_offers.id
    AND public.plan_row_status(plan_offers.plan_id) IN ('agreed', 'awaiting_payment')
  )
  WITH CHECK (bidder_id = auth.uid());

-- plan_engagements: same pattern (was EXISTS on plans)
DROP POLICY IF EXISTS plan_engagements_select ON public.plan_engagements;
CREATE POLICY plan_engagements_select ON public.plan_engagements FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.plan_creator_id(plan_id) = auth.uid()
  );
