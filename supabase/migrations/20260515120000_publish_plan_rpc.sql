/**
 * Plan publish via RPC: INSERT runs inside SECURITY DEFINER with row_security off so a trusted
 * session always publishes when `user_may_create_plan(auth.uid())` is true — avoids PostgREST
 * edge cases where the same user still sees "violates row-level security" on `plans` INSERT.
 *
 * `creator_id` is always taken from `auth.uid()`; JSON payload is trusted only for non-identity fields.
 */

CREATE OR REPLACE FUNCTION public.publish_plan(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.user_may_create_plan(uid) THEN
    RAISE EXCEPTION 'Not allowed to publish plans'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.plans (
    creator_id,
    meet_type_id,
    title,
    description,
    starting_price_cents,
    currency,
    status,
    visibility,
    scheduled_at,
    location_label,
    latitude,
    longitude,
    is_paid,
    budget_min_cents,
    budget_max_cents,
    budget_tier,
    escrow_pattern,
    host_contribution_bps,
    is_mood_plan,
    mood_expires_at,
    duration_minutes,
    mood_type,
    mood_start_time,
    mood_end_time,
    auto_expiry_at,
    urgency_level,
    negotiation_expires_at,
    spotlight_enabled,
    boosted_until
  )
  VALUES (
    uid,
    (nullif(trim(payload #>> '{meet_type_id}'), ''))::uuid,
    trim(payload #>> '{title}'),
    nullif(trim(payload #>> '{description}'), ''),
    nullif(payload #>> '{starting_price_cents}', '')::integer,
    coalesce(nullif(trim(payload #>> '{currency}'), ''), 'NGN'),
    coalesce(nullif(trim(payload #>> '{status}'), ''), 'negotiating')::public.plan_status,
    coalesce(nullif(trim(payload #>> '{visibility}'), ''), 'public'),
    nullif(trim(payload #>> '{scheduled_at}'), '')::timestamptz,
    nullif(trim(payload #>> '{location_label}'), ''),
    nullif(payload #>> '{latitude}', '')::double precision,
    nullif(payload #>> '{longitude}', '')::double precision,
    case
      when payload ? 'is_paid' then coalesce((payload->>'is_paid')::boolean, true)
      else true
    end,
    nullif(payload #>> '{budget_min_cents}', '')::integer,
    nullif(payload #>> '{budget_max_cents}', '')::integer,
    nullif(trim(payload #>> '{budget_tier}'), ''),
    nullif(trim(payload #>> '{escrow_pattern}'), ''),
    nullif(payload #>> '{host_contribution_bps}', '')::integer,
    case
      when payload ? 'is_mood_plan' then coalesce((payload->>'is_mood_plan')::boolean, false)
      else false
    end,
    nullif(trim(payload #>> '{mood_expires_at}'), '')::timestamptz,
    nullif(payload #>> '{duration_minutes}', '')::integer,
    nullif(trim(payload #>> '{mood_type}'), ''),
    nullif(trim(payload #>> '{mood_start_time}'), '')::timestamptz,
    nullif(trim(payload #>> '{mood_end_time}'), '')::timestamptz,
    nullif(trim(payload #>> '{auto_expiry_at}'), '')::timestamptz,
    nullif(trim(payload #>> '{urgency_level}'), ''),
    nullif(trim(payload #>> '{negotiation_expires_at}'), '')::timestamptz,
    case
      when payload ? 'spotlight_enabled' then coalesce((payload->>'spotlight_enabled')::boolean, false)
      else false
    end,
    nullif(trim(payload #>> '{boosted_until}'), '')::timestamptz
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_plan(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_plan(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.publish_plan(jsonb) IS
  'Inserts a plan row as auth.uid(); enforces user_may_create_plan; bypasses plans INSERT RLS.';

NOTIFY pgrst, 'reload schema';
