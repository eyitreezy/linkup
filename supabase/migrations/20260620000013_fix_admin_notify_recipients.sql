/**
 * Notify all admins in-app even when public.users.email is null (email edge fn resolves separately).
 */

CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.user_id,
    COALESCE(NULLIF(trim(u.email), ''), NULLIF(trim(au.email::text), '')) AS email
  FROM public.admins a
  JOIN public.users u ON u.id = a.user_id
  LEFT JOIN auth.users au ON au.id = a.user_id;
$$;

NOTIFY pgrst, 'reload schema';
