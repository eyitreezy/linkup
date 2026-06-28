/**
 * Admin meet types: reliable admin notify on pending insert, auth email fallback, realtime.
 */

-- Resolve admin emails from public.users or auth.users
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.user_id,
    COALESCE(NULLIF(trim(u.email), ''), NULLIF(trim(au.email::text), '')) AS email
  FROM public.admins a
  JOIN public.users u ON u.id = a.user_id
  LEFT JOIN auth.users au ON au.id = a.user_id
  WHERE COALESCE(NULLIF(trim(u.email), ''), NULLIF(trim(au.email::text), '')) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_meet_type_submitted(
  p_meet_type_id UUID,
  p_meet_type_name TEXT,
  p_creator_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _creator_name TEXT;
BEGIN
  SELECT display_name INTO _creator_name
  FROM public.profiles
  WHERE user_id = p_creator_id;

  FOR _admin IN SELECT * FROM public.get_admin_user_ids() LOOP
    PERFORM public.create_notification(
      _admin.user_id,
      'meet_type_submitted',
      'New meet type pending approval',
      format(
        '"%s" submitted by %s is awaiting your review.',
        p_meet_type_name,
        COALESCE(_creator_name, 'a member')
      ),
      jsonb_build_object(
        'href', '/admin',
        'meetTypeId', p_meet_type_id,
        'meetTypeName', p_meet_type_name
      ),
      'medium'::public.notification_priority,
      'meet_type_submitted:' || p_meet_type_id::text
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_meet_types_notify_admins_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'pending'
    AND NEW.created_by IS NOT NULL
    AND COALESCE(NEW.is_admin_managed, false) = false
  THEN
    PERFORM public.notify_admins_meet_type_submitted(NEW.id, NEW.name, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meet_types_notify_admins_pending ON public.meet_types;
CREATE TRIGGER meet_types_notify_admins_pending
  AFTER INSERT ON public.meet_types
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_meet_types_notify_admins_pending();

-- Realtime for admin panel live updates
ALTER TABLE public.meet_types REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meet_types'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meet_types;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
