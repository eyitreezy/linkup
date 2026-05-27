/**
 * Stops "infinite recursion detected in policy for relation plans".
 *
 * Inline `plans_select` used `EXISTS (SELECT plan_offers ...)`, which evaluates
 * `offers_select` → `plan_creator_id()` → `SELECT plans` under RLS → `plans_select` again.
 *
 * Single policy predicate: one SECURITY DEFINER function that turns row_security OFF
 * for its body so reads of `plans` / `plan_offers` do not re-enter RLS.
 */
CREATE OR REPLACE FUNCTION public.auth_uid_can_see_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ok boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT
    pl.creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      pl.visibility IN ('public', 'radius')
      AND COALESCE(pl.is_suppressed, false) = false
    )
    OR EXISTS (
      SELECT 1
      FROM public.plan_offers o
      WHERE o.plan_id = pl.id
        AND o.bidder_id = auth.uid()
    )
  INTO ok
  FROM public.plans pl
  WHERE pl.id = p_plan_id;

  RETURN COALESCE(ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_uid_can_see_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_see_plan(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans FOR SELECT
  USING (public.auth_uid_can_see_plan(id));
