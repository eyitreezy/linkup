/**
 * Plan publish still blocked after earlier RLS migrations — common causes:
 * - verification_requests is `ai_pass` but users row never moved to `verified` (only `admin_approved` synced before).
 * - Backfill drift: approval exists but users / badge not updated.
 *
 * This migration: (1) syncs ai_pass → verified like admin_approved, (2) expands user_may_create_plan,
 * (3) backfills users + profiles, (4) recreates plans_insert FOR authenticated.
 */

CREATE OR REPLACE FUNCTION public.trg_verification_request_apply_user_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN (
    'admin_approved'::public.verification_request_status,
    'ai_pass'::public.verification_request_status
  ) THEN
    UPDATE public.users
    SET verification_status = 'verified'::public.user_verification_status
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'admin_rejected'::public.verification_request_status THEN
    UPDATE public.users
    SET verification_status = 'rejected'::public.user_verification_status
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: any approved / AI-pass request should match a verified user row (fixes missed triggers).
UPDATE public.users u
SET verification_status = 'verified'::public.user_verification_status
WHERE u.verification_status IS DISTINCT FROM 'verified'::public.user_verification_status
  AND EXISTS (
    SELECT 1
    FROM public.verification_requests vr
    WHERE vr.user_id = u.id
      AND vr.status IN (
        'admin_approved'::public.verification_request_status,
        'ai_pass'::public.verification_request_status
      )
  );

UPDATE public.profiles p
SET verified_badge = (u.verification_status = 'verified'::public.user_verification_status)
FROM public.users u
WHERE p.user_id = u.id
  AND p.verified_badge IS DISTINCT FROM (u.verification_status = 'verified'::public.user_verification_status);

CREATE OR REPLACE FUNCTION public.user_may_create_plan(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  TO authenticated
  WITH CHECK (
    auth.uid() = creator_id
    AND public.user_may_create_plan(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
