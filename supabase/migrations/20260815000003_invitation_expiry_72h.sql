-- Default invitation expiry: 72 hours (still capped by meetup - 48h).

CREATE OR REPLACE FUNCTION public._plan_invitation_expires_at(p_plan public.plans)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT LEAST(
    NOW() + INTERVAL '72 hours',
    COALESCE(p_plan.scheduled_at - INTERVAL '48 hours', NOW() + INTERVAL '72 hours')
  );
$$;

NOTIFY pgrst, 'reload schema';
