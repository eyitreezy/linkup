/**
 * Fix "infinite recursion detected in policy for relation plans":
 * plans_select → EXISTS(plan_offers) → offers_select → plan_* helpers → SELECT plans
 * still re-evaluates RLS on plans unless helpers disable row_security for their read.
 *
 * Recreate SECURITY DEFINER helpers with row_security OFF for the function body.
 */
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.plan_creator_id(plan_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT creator_id FROM public.plans WHERE id = plan_id;
$$;

CREATE OR REPLACE FUNCTION public.plan_accepted_offer_id(plan_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT accepted_offer_id FROM public.plans WHERE id = plan_id;
$$;

CREATE OR REPLACE FUNCTION public.plan_row_status(plan_id uuid)
RETURNS public.plan_status
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT status FROM public.plans WHERE id = plan_id;
$$;

-- Discovery: do not expose suppressed plans to the public/radius branches (trust & safety).
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans FOR SELECT
  USING (
    creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      visibility IN ('public', 'radius')
      AND COALESCE(is_suppressed, false) = false
    )
    OR EXISTS (
      SELECT 1 FROM public.plan_offers o WHERE o.plan_id = plans.id AND o.bidder_id = auth.uid()
    )
  );
