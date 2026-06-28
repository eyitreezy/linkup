/**
 * Admin meet type management: flag admin-owned catalog rows; tighten user CRUD; grant admin write access.
 */

ALTER TABLE public.meet_types
  ADD COLUMN IF NOT EXISTS is_admin_managed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meet_types.is_admin_managed IS
  'Admin-created catalog types (created_by NULL). Not editable/deletable by regular users.';

-- Users cannot create admin-managed rows
DROP POLICY IF EXISTS meet_types_insert_user ON public.meet_types;
CREATE POLICY meet_types_insert_user ON public.meet_types
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_active IS TRUE
    AND is_admin_managed = false
  );

DROP POLICY IF EXISTS meet_types_update_user ON public.meet_types;
CREATE POLICY meet_types_update_user ON public.meet_types
  FOR UPDATE TO authenticated
  USING (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed = false
  )
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed = false
  );

DROP POLICY IF EXISTS meet_types_delete_user ON public.meet_types;
CREATE POLICY meet_types_delete_user ON public.meet_types
  FOR DELETE TO authenticated
  USING (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed = false
  );

DROP POLICY IF EXISTS meet_types_admin_insert ON public.meet_types;
CREATE POLICY meet_types_admin_insert ON public.meet_types
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS meet_types_admin_update ON public.meet_types;
CREATE POLICY meet_types_admin_update ON public.meet_types
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS meet_types_admin_delete ON public.meet_types;
CREATE POLICY meet_types_admin_delete ON public.meet_types
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';
