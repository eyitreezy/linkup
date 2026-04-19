/**
 * public.users.name may be NOT NULL in hosted projects while handle_new_user() only inserted
 * (id, email) — OAuth/email signup then fails with 23502 on "name".
 *
 * Ensures name exists where missing, and sets it from user metadata (same derivation as display_name).
 */
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

  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, derived_name)
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      name = EXCLUDED.name;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, derived_name)
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
