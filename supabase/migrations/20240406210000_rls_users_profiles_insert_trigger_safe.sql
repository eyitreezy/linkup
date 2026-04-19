/**
 * Registration inserts run inside handle_new_user() (trigger on auth.users). There is no JWT,
 * so policies that only allow auth.uid() = id / user_id block inserts.
 *
 * Fix: allow INSERT when pg_trigger_depth() > 0 (inside a trigger) OR when the row is self-owned
 * (auth.uid() = id / user_id). This replaces conflicting experimental policies.
 *
 * Run in Supabase SQL Editor after prior migrations, or: npx supabase db push
 */
DROP POLICY IF EXISTS linkup_users_insert_db_role ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_db_role ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_postgres ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_postgres ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_auth_admin ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_auth_admin ON public.profiles;
DROP POLICY IF EXISTS users_insert_own_signup ON public.users;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;

CREATE POLICY users_insert_signup ON public.users
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = id)
    OR (pg_trigger_depth() > 0)
  );

CREATE POLICY profiles_insert_signup ON public.profiles
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (pg_trigger_depth() > 0)
  );

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

ALTER TABLE IF EXISTS public.users OWNER TO postgres;
ALTER TABLE IF EXISTS public.profiles OWNER TO postgres;
ALTER TABLE IF EXISTS public.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles NO FORCE ROW LEVEL SECURITY;
