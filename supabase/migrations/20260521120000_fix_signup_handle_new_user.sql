/**
 * Fix "Database error saving new user" on email/password sign-up.
 *
 * Root cause: handle_new_user() INSERT into public.users / public.profiles is blocked by RLS
 * (auth.uid() is NULL in auth.users triggers) or NOT NULL columns (name, password_hash).
 *
 * Safe to re-run in Supabase SQL Editor or: npx supabase db push
 */
-- ---------------------------------------------------------------------------
-- Schema guards (hosted projects sometimes drift)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN name TEXT NOT NULL DEFAULT 'Member';
    ALTER TABLE public.users
      ALTER COLUMN name DROP DEFAULT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.users OWNER TO postgres;
ALTER TABLE IF EXISTS public.profiles OWNER TO postgres;
ALTER TABLE IF EXISTS public.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles NO FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- INSERT policies: trigger depth, backend roles, and self-signup (API)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS linkup_users_insert_postgres ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_postgres ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_auth_admin ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_auth_admin ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_db_role ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_db_role ON public.profiles;
DROP POLICY IF EXISTS users_insert_own_signup ON public.users;
DROP POLICY IF EXISTS users_insert_signup ON public.users;
DROP POLICY IF EXISTS profiles_insert_signup ON public.profiles;

-- Legacy policy from init blocks trigger inserts when auth.uid() IS NULL
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;

CREATE POLICY users_insert_signup ON public.users
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = id)
    OR (pg_trigger_depth() > 0)
    OR (
      current_user = ANY (
        ARRAY['postgres'::name, 'supabase_auth_admin'::name, 'supabase_admin'::name]
      )
    )
  );

CREATE POLICY profiles_insert_signup ON public.profiles
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (pg_trigger_depth() > 0)
    OR (
      current_user = ANY (
        ARRAY['postgres'::name, 'supabase_auth_admin'::name, 'supabase_admin'::name]
      )
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    DROP POLICY IF EXISTS linkup_users_insert_auth_admin ON public.users;
    DROP POLICY IF EXISTS linkup_profiles_insert_auth_admin ON public.profiles;
    CREATE POLICY linkup_users_insert_auth_admin ON public.users
      FOR INSERT TO supabase_auth_admin
      WITH CHECK (true);
    CREATE POLICY linkup_profiles_insert_auth_admin ON public.profiles
      FOR INSERT TO supabase_auth_admin
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Trigger: create public.users + profiles for every new auth.users row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived_name text;
BEGIN
  derived_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    'Member'
  );

  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    SET LOCAL row_security = off;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, derived_name)
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), public.users.name, derived_name);

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, derived_name)
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = COALESCE(NULLIF(trim(EXCLUDED.display_name), ''), public.profiles.display_name);

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
