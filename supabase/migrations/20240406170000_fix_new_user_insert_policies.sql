/**
 * "Database error saving new user" happens when handle_new_user() cannot INSERT into
 * public.users / public.profiles: RLS blocks inserts because auth.uid() is NULL in triggers,
 * or SET LOCAL row_security = off is not allowed for the function owner.
 *
 * Fix: INSERT policies limited to role postgres (used by SECURITY DEFINER when owned by postgres).
 * API clients use role "authenticated", so they still cannot insert arbitrary rows.
 *
 * Apply: supabase db push  OR  paste this file into Supabase Dashboard → SQL Editor → Run.
 */
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP POLICY IF EXISTS linkup_users_insert_postgres ON public.users;
CREATE POLICY linkup_users_insert_postgres ON public.users
  FOR INSERT
  TO postgres
  WITH CHECK (true);

DROP POLICY IF EXISTS linkup_profiles_insert_postgres ON public.profiles;
CREATE POLICY linkup_profiles_insert_postgres ON public.profiles
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- Hosted Supabase may use supabase_auth_admin for auth internals (optional).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    DROP POLICY IF EXISTS linkup_users_insert_auth_admin ON public.users;
    CREATE POLICY linkup_users_insert_auth_admin ON public.users
      FOR INSERT TO supabase_auth_admin WITH CHECK (true);
    DROP POLICY IF EXISTS linkup_profiles_insert_auth_admin ON public.profiles;
    CREATE POLICY linkup_profiles_insert_auth_admin ON public.profiles
      FOR INSERT TO supabase_auth_admin WITH CHECK (true);
  END IF;
END $$;

-- Remove SET LOCAL row_security (can error on some roles); rely on policies above.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
