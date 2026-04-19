/**
 * Some hosted DBs add public.users.password_hash NOT NULL — signup/OAuth then fails (23502) because
 * handle_new_user() must not copy secrets into public (passwords live in auth.users only).
 *
 * Drops NOT NULL so new rows can omit it. Prefer removing this column in Dashboard if unused.
 */
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
