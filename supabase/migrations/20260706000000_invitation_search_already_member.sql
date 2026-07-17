-- Invitation search: surface existing plan members with already_member + gender for host UX.

DROP FUNCTION IF EXISTS public.search_users_for_invitation(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.search_users_for_invitation(
  p_query TEXT,
  p_plan_id UUID
)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  is_kyc_verified BOOLEAN,
  already_invited BOOLEAN,
  already_member BOOLEAN,
  gender TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q TEXT := trim(COALESCE(p_query, ''));
BEGIN
  IF length(_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    NULL::TEXT AS username,
    p.avatar_url,
    (u.verification_status = 'verified') AS is_kyc_verified,
    EXISTS (
      SELECT 1 FROM public.plan_invitations pi
      WHERE pi.plan_id = p_plan_id
        AND pi.invitee_user_id = p.user_id
        AND pi.status NOT IN ('declined', 'expired', 'cancelled')
    ) AS already_invited,
    (
      EXISTS (
        SELECT 1 FROM public.plan_offers po
        WHERE po.plan_id = p_plan_id
          AND po.bidder_id = p.user_id
          AND po.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1 FROM public.escrow_transactions et
        WHERE et.plan_id = p_plan_id AND et.guest_id = p.user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.plan_join_requests jr
        WHERE jr.plan_id = p_plan_id
          AND jr.requester_id = p.user_id
          AND jr.status = 'approved'
      )
    ) AS already_member,
    p.gender
  FROM public.profiles p
  JOIN public.users u ON u.id = p.user_id
  WHERE
    p.user_id != auth.uid()
    AND (
      p.display_name ILIKE '%' || _q || '%'
      OR u.email ILIKE '%' || _q || '%'
    )
  ORDER BY
    CASE WHEN p.display_name ILIKE _q || '%' THEN 0 ELSE 1 END,
    p.display_name
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.search_users_for_invitation(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users_for_invitation(TEXT, UUID) TO authenticated;
