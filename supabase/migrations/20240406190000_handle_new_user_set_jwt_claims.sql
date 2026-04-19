/**
 * Triggers run without a real JWT, so auth.uid() is NULL and RLS blocks inserts.
 * Set request.jwt.claim.sub to the new auth user id for the rest of this transaction
 * so existing policies (auth.uid() = id / user_id) succeed — same pattern Supabase
 * recommends for trigger code that must satisfy RLS.
 *
 * Also adds public.users INSERT policy (previously missing): only where id = auth.uid().
 */
DROP POLICY IF EXISTS linkup_users_insert_db_role ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_db_role ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_postgres ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_postgres ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_auth_admin ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_auth_admin ON public.profiles;

DROP POLICY IF EXISTS users_insert_own_signup ON public.users;
CREATE POLICY users_insert_own_signup ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(trim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
      'Member'
    )
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
