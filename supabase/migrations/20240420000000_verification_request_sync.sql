-- Single flow: verification_requests (admin decision) → users.verification_status → profiles.verified_badge
-- profiles.verified_badge stays denormalized for public feed (RLS hides users.verification_status from other users).

CREATE OR REPLACE FUNCTION public.trg_sync_verified_badge_from_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    UPDATE public.profiles
    SET verified_badge = (NEW.verification_status = 'verified'::public.user_verification_status)
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_users_verification_sync_badge ON public.users;
CREATE TRIGGER tr_users_verification_sync_badge
  AFTER UPDATE OF verification_status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_verified_badge_from_users();

-- When a request is approved/rejected, apply the outcome to public.users (badge sync runs via trigger above).
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

  IF NEW.status = 'admin_approved'::public.verification_request_status THEN
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

DROP TRIGGER IF EXISTS tr_verification_request_apply_user ON public.verification_requests;
CREATE TRIGGER tr_verification_request_apply_user
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_verification_request_apply_user_status();

-- Align existing rows (triggers only fire on subsequent updates).
UPDATE public.profiles p
SET verified_badge = (u.verification_status = 'verified'::public.user_verification_status)
FROM public.users u
WHERE p.user_id = u.id  AND p.verified_badge IS DISTINCT FROM (u.verification_status = 'verified'::public.user_verification_status);
