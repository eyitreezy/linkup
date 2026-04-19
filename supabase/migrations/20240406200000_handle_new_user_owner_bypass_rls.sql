/**
 * If RLS still blocks the trigger: table owner normally BYPASSES RLS unless
 * FORCE ROW LEVEL SECURITY is on. Hosted projects sometimes use a non-postgres
 * table owner or FORCE is enabled — fix ownership + NO FORCE, and use a plain
 * trigger body (set_config often does NOT affect auth.uid() inside RLS on Supabase).
 *
 * Run in Supabase SQL Editor (as postgres). Then retry sign-up.
 */
ALTER TABLE IF EXISTS public.users OWNER TO postgres;
ALTER TABLE IF EXISTS public.profiles OWNER TO postgres;

ALTER TABLE IF EXISTS public.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles NO FORCE ROW LEVEL SECURITY;

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
