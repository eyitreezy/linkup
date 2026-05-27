/**
 * Duplicate plan from Plan management: bypasses `plans` INSERT RLS (same family as `publish_plan`)
 * while enforcing that the caller owns the source row. Produces a **draft** with agreement,
 * mood TTL, boosts, and spotlight cleared so `tr_plans_financial_guard` and mood rules stay valid.
 */

CREATE OR REPLACE FUNCTION public.duplicate_plan_for_creator(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  src public.plans%ROWTYPE;
  new_id uuid;
  copy_title text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  SELECT * INTO src FROM public.plans WHERE id = p_plan_id AND creator_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  copy_title := trim(src.title) || ' (copy)';
  IF length(copy_title) > 200 THEN
    copy_title := left(trim(src.title), 190) || '… (copy)';
  END IF;

  INSERT INTO public.plans (
    creator_id,
    meet_type_id,
    title,
    description,
    category,
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
    boosted_until,
    is_suppressed,
    is_expired,
    creator_can_manage,
    archived_at,
    accepted_offer_id,
    agreed_price_cents,
    agreed_scheduled_at,
    agreed_location,
    agreed_notes
  )
  VALUES (
    uid,
    src.meet_type_id,
    copy_title,
    src.description,
    src.category,
    src.starting_price_cents,
    src.currency,
    'draft'::public.plan_status,
    src.visibility,
    src.scheduled_at,
    src.location_label,
    src.latitude,
    src.longitude,
    src.is_paid,
    src.budget_min_cents,
    src.budget_max_cents,
    src.budget_tier,
    src.escrow_pattern,
    src.host_contribution_bps,
    false,
    NULL,
    src.duration_minutes,
    src.mood_type,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    false,
    false,
    true,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_plan_for_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_plan_for_creator(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.duplicate_plan_for_creator(uuid) IS
  'Clones a plan as draft for auth.uid() when they own the source; bypasses plans INSERT RLS.';

NOTIFY pgrst, 'reload schema';
