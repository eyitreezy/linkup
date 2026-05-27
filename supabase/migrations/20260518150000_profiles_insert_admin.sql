/**
 * Let admins create a minimal profile row when a user exists but `profiles` was never inserted
 * (recovery / edge cases). Mirrors existing `profiles_update_admin`.
 */
DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND user_id IS NOT NULL);
