/**
 * Publish still blocked for some projects:
 * - `user_may_create_plan` reads `users` / `profiles` / `verification_requests`; ensure those
 *   reads are not restricted by RLS during the SECURITY DEFINER body (match `plan_creator_id`).
 * - `plans_insert ... TO authenticated` excludes sessions when the JWT role claim is not exactly
 *   `authenticated`; omit role restriction so the same WITH CHECK still gates on `auth.uid()`.
 */

CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = check_uid);
$$;

CREATE OR REPLACE FUNCTION public.user_may_create_plan(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT check_uid IS NOT NULL
  AND (
    public.is_admin(check_uid)
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
    )
    OR EXISTS (
      SELECT 1
      FROM public.verification_requests vr
      WHERE vr.user_id = check_uid
        AND vr.status IN (
          'admin_approved'::public.verification_request_status,
          'ai_pass'::public.verification_request_status
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.user_may_create_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_may_create_plan(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS plans_insert ON public.plans;
CREATE POLICY plans_insert ON public.plans
  FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND public.user_may_create_plan(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
