/**
 * Allow creators to remove their own drafts and admins to remove any plan (client moderation).
 * Without a FOR DELETE policy, authenticated deletes on `plans` are denied under RLS.
 */
DROP POLICY IF EXISTS plans_delete_moderation ON public.plans;
CREATE POLICY plans_delete_moderation ON public.plans FOR DELETE
  USING (
    public.is_admin(auth.uid())
    OR (creator_id = auth.uid() AND status = 'draft'::public.plan_status)
  );
