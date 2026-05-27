/**
 * Reliable `plans` INSERT RLS: evaluate trust in SECURITY DEFINER so nested reads on
 * `users` / `profiles` are not affected by subtle RLS evaluation during WITH CHECK.
 *
 * Matches product rules:
 * - Creator must be the signed-in user (still enforced in policy).
 * - Trusted if verified on `users`, or `profiles.verified_badge` (kept in sync by triggers),
 *   or admin (match app/admin tooling expectations).
 */

CREATE OR REPLACE FUNCTION public.user_may_create_plan(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(check_uid)
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = check_uid
      AND u.verification_status = 'verified'::public.user_verification_status
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = check_uid
      AND p.verified_badge = true
  );
$$;

REVOKE ALL ON FUNCTION public.user_may_create_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_may_create_plan(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS plans_insert ON public.plans;
CREATE POLICY plans_insert ON public.plans FOR INSERT
WITH CHECK (
  auth.uid() = creator_id
  AND public.user_may_create_plan(auth.uid())
);

NOTIFY pgrst, 'reload schema';
