/**
 * Meet type submission & approval: approval_status, notifications, RLS for own pending rows.
 */

ALTER TABLE public.meet_types
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN public.meet_types.approval_status IS
  'User-created types start pending; catalog/admin rows stay approved.';

-- Catalog + admin rows: already approved
UPDATE public.meet_types
SET approval_status = 'approved'
WHERE created_by IS NULL;

-- Existing user-created rows that were already active
UPDATE public.meet_types
SET approval_status = 'approved'
WHERE created_by IS NOT NULL AND is_active = true;

-- ---------------------------------------------------------------------------
-- SELECT: creators see own inactive/pending rows; admins see all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS meet_types_select ON public.meet_types;
CREATE POLICY meet_types_select ON public.meet_types
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- INSERT: user-owned types start inactive + pending
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS meet_types_insert_user ON public.meet_types;
CREATE POLICY meet_types_insert_user ON public.meet_types
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed = false
    AND is_active = false
    AND approval_status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- Admin helpers & notification RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id, u.email
  FROM public.admins a
  JOIN public.users u ON u.id = a.user_id
  WHERE u.email IS NOT NULL;
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
      )
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_user_meet_type_approved(
  p_meet_type_id UUID,
  p_meet_type_name TEXT,
  p_user_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(
    p_user_id,
    'meet_type_approved',
    'Meet type approved!',
    format(
      'Your meet type "%s" has been approved and is now available to use.',
      p_meet_type_name
    ),
    jsonb_build_object(
      'href', '/plan/create',
      'meetTypeId', p_meet_type_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_user_meet_type_rejected(
  p_meet_type_id UUID,
  p_meet_type_name TEXT,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(
    p_user_id,
    'meet_type_rejected',
    'Meet type not approved',
    format(
      'Your meet type "%s" was not approved%s.',
      p_meet_type_name,
      CASE WHEN p_reason IS NOT NULL AND trim(p_reason) <> '' THEN ': ' || trim(p_reason) ELSE '' END
    ),
    jsonb_build_object(
      'href', '/plan/create',
      'meetTypeId', p_meet_type_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.notify_admins_meet_type_submitted(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_meet_type_submitted(UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_user_meet_type_approved(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user_meet_type_approved(UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_user_meet_type_rejected(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user_meet_type_rejected(UUID, TEXT, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
