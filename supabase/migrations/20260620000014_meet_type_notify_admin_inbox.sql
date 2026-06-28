/**
 * Meet type admin notifications: high priority + deep link to Meet types tab.
 */

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
        'adminTab', 'meet_types',
        'meetTypeId', p_meet_type_id,
        'meetTypeName', p_meet_type_name
      ),
      'high'::public.notification_priority,
      'meet_type_submitted:' || p_meet_type_id::text
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
