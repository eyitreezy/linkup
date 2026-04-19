/**
 * RLS policies "TO postgres" fail if the trigger runs as another DB role (varies by Supabase version).
 * This policy allows INSERT only when current_user is a backend role (not anon/authenticated API clients).
 *
 * Run after 20240406170000. Safe to run multiple times.
 */
DROP POLICY IF EXISTS linkup_users_insert_postgres ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_postgres ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_auth_admin ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_auth_admin ON public.profiles;
DROP POLICY IF EXISTS linkup_users_insert_db_role ON public.users;
DROP POLICY IF EXISTS linkup_profiles_insert_db_role ON public.profiles;

CREATE POLICY linkup_users_insert_db_role ON public.users
  FOR INSERT
  WITH CHECK (
    current_user = ANY (
      ARRAY[
        'postgres'::name,
        'supabase_auth_admin'::name,
        'supabase_admin'::name
      ]
    )
  );

CREATE POLICY linkup_profiles_insert_db_role ON public.profiles
  FOR INSERT
  WITH CHECK (
    current_user = ANY (
      ARRAY[
        'postgres'::name,
        'supabase_auth_admin'::name,
        'supabase_admin'::name
      ]
    )
  );

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
