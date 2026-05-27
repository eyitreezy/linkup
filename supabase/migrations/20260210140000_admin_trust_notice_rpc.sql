/**
 * Allow admins to send generic in-app notices without direct INSERT on notifications
 * (table remains trigger/RPC-only for normal users).
 */
CREATE OR REPLACE FUNCTION public.admin_send_user_notice(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data JSONB := COALESCE(p_data, '{}'::jsonb);
  v_href TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  v_href := NULLIF(trim(v_data->>'href'), '');
  IF v_href IS NULL THEN
    v_href := '/(tabs)/profile';
  END IF;

  PERFORM public.create_notification(
    p_user_id,
    'account_restriction',
    p_title,
    p_body,
    v_data || jsonb_build_object('href', v_href),
    'high',
    'admin_notice:' || p_user_id::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_send_user_notice(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_send_user_notice(UUID, TEXT, TEXT, JSONB) TO authenticated;
