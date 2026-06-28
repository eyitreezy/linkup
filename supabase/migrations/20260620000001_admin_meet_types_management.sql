/**
 * Admin meet type management: protect admin-managed rows from user CRUD;
 * allow admins to insert/update/delete any meet type.
 */
ALTER TABLE public.meet_types
  ADD COLUMN IF NOT EXISTS is_admin_managed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meet_types.is_admin_managed IS
  'When true, only admins may update/delete; visible to all users when is_active.';

DROP POLICY IF EXISTS meet_types_insert_user ON public.meet_types;
CREATE POLICY meet_types_insert_user ON public.meet_types
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_active IS TRUE
    AND is_admin_managed IS FALSE
  );

DROP POLICY IF EXISTS meet_types_update_user ON public.meet_types;
DROP POLICY IF EXISTS meet_types_update_own ON public.meet_types;
CREATE POLICY meet_types_update_user ON public.meet_types
  FOR UPDATE TO authenticated
  USING (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed IS FALSE
  )
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed IS FALSE
  );

DROP POLICY IF EXISTS meet_types_delete_user ON public.meet_types;
CREATE POLICY meet_types_delete_user ON public.meet_types
  FOR DELETE TO authenticated
  USING (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_admin_managed IS FALSE
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

DROP POLICY IF EXISTS meet_types_select ON public.meet_types;
CREATE POLICY meet_types_select ON public.meet_types
  FOR SELECT
  USING (
    is_active = true
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
