/**
 * Extend plan publish trust: treat verification_requests.admin_approved as publish-eligible
 * even if users.verification_status or badge sync lagged (manual DB, missed trigger, etc.).
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.verification_requests vr
    WHERE vr.user_id = check_uid
      AND vr.status = 'admin_approved'::public.verification_request_status
  );
$$;

REVOKE ALL ON FUNCTION public.user_may_create_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_may_create_plan(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
