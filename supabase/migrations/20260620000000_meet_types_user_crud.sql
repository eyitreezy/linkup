/**
 * User-owned meet types: update name/icon and delete (catalog rows keep created_by NULL).
 */
DROP POLICY IF EXISTS meet_types_update_user ON public.meet_types;
CREATE POLICY meet_types_update_user ON public.meet_types
  FOR UPDATE TO authenticated
  USING (created_by IS NOT NULL AND created_by = auth.uid())
  WITH CHECK (created_by IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS meet_types_delete_user ON public.meet_types;
CREATE POLICY meet_types_delete_user ON public.meet_types
  FOR DELETE TO authenticated
  USING (created_by IS NOT NULL AND created_by = auth.uid());

NOTIFY pgrst, 'reload schema';
