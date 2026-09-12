-- Group plan membership, capacity, and opt-out fixes.
-- Keeps client gating in lib/plans/groupPlanMembership.ts in sync.

-- Widen opt-out amounts (prevent integer overflow on large contribution values).
ALTER TABLE public.group_plan_opt_outs
  ALTER COLUMN contribution_amount_cents TYPE BIGINT,
  ALTER COLUMN platform_fee_refunded_cents TYPE BIGINT;

-- Count distinct confirmed guests from offers, approved join requests, and active escrow legs.
CREATE OR REPLACE FUNCTION public.sync_group_plan_accepted_guest_count(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt int;
BEGIN
  SELECT COUNT(DISTINCT guest_user_id)::int
  INTO v_cnt
  FROM (
    SELECT o.bidder_id AS guest_user_id
    FROM public.plan_offers o
    WHERE o.plan_id = p_plan_id
      AND o.status = 'accepted'::public.offer_status
    UNION
    SELECT jr.requester_id AS guest_user_id
    FROM public.plan_join_requests jr
    WHERE jr.plan_id = p_plan_id
      AND jr.status = 'approved'
    UNION
    SELECT et.guest_id AS guest_user_id
    FROM public.escrow_transactions et
    WHERE et.plan_id = p_plan_id
      AND et.guest_id IS NOT NULL
      AND et.status NOT IN ('cancelled', 'refunded')
  ) guests
  WHERE guest_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.group_plan_opt_outs oo
      WHERE oo.plan_id = p_plan_id
        AND oo.user_id = guests.guest_user_id
    );

  UPDATE public.plans
  SET accepted_guest_count = v_cnt,
      updated_at = now()
  WHERE id = p_plan_id
    AND is_group_plan = true
    AND accepted_guest_count IS DISTINCT FROM v_cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_guest_opt_out(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _offer public.plan_offers%ROWTYPE;
  _join_req public.plan_join_requests%ROWTYPE;
  _hours_until NUMERIC;
  _new_count INT;
  _contribution BIGINT := 0;
  _fee BIGINT;
  _refund JSONB;
  _has_participation BOOLEAN := false;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_a_group_plan'; END IF;

  _hours_until := EXTRACT(EPOCH FROM (COALESCE(_plan.scheduled_at, NOW()) - NOW())) / 3600;
  IF _hours_until < 48 THEN
    RAISE EXCEPTION 'opt_out_window_closed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_plan_opt_outs WHERE plan_id = p_plan_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'already_opted_out';
  END IF;

  SELECT * INTO _offer
  FROM public.plan_offers
  WHERE plan_id = p_plan_id AND bidder_id = _user_id AND status = 'accepted'::public.offer_status
  FOR UPDATE;

  IF FOUND THEN
    _has_participation := true;
  ELSE
    SELECT * INTO _join_req
    FROM public.plan_join_requests
    WHERE plan_id = p_plan_id AND requester_id = _user_id AND status = 'approved'
    FOR UPDATE;

    IF FOUND THEN
      _has_participation := true;
    ELSIF EXISTS (
      SELECT 1
      FROM public.escrow_transactions et
      WHERE et.plan_id = p_plan_id
        AND et.guest_id = _user_id
        AND et.status NOT IN ('cancelled', 'refunded')
    ) THEN
      _has_participation := true;
    END IF;
  END IF;

  IF NOT _has_participation THEN
    RAISE EXCEPTION 'not_a_participant';
  END IF;

  SELECT COALESCE(et.guest_share_cents, 0)
  INTO _contribution
  FROM public.escrow_transactions et
  WHERE et.plan_id = p_plan_id
    AND et.guest_id = _user_id
    AND et.status NOT IN ('cancelled', 'refunded')
  ORDER BY et.created_at DESC
  LIMIT 1;

  IF _contribution <= 0 THEN
    _contribution := COALESCE(_offer.current_amount_cents, _offer.amount_cents, 0)::BIGINT;
  END IF;

  IF _contribution <= 0 THEN
    _contribution := COALESCE(public.resolve_join_request_slot_cents(_plan), 0);
  END IF;

  _fee := public.platform_fee_cents_for_amount(_contribution);

  INSERT INTO public.group_plan_opt_outs (
    plan_id, user_id, contribution_amount_cents, platform_fee_refunded_cents
  ) VALUES (
    p_plan_id, _user_id, _contribution, _fee
  );

  _refund := public._refund_group_guest_escrow(p_plan_id, _user_id, true);

  IF _offer.id IS NOT NULL THEN
    UPDATE public.plan_offers
    SET status = 'opted_out'::public.offer_status
    WHERE id = _offer.id;
  END IF;

  IF _join_req.id IS NOT NULL THEN
    UPDATE public.plan_join_requests
    SET status = 'declined', responded_at = NOW()
    WHERE id = _join_req.id;
  END IF;

  PERFORM public.sync_group_plan_accepted_guest_count(p_plan_id);

  SELECT accepted_guest_count INTO _new_count FROM public.plans WHERE id = p_plan_id;

  IF _new_count < COALESCE(_plan.minimum_member_count, 5) THEN
    UPDATE public.plans
    SET status = 'cancelled',
        cancellation_reason_type = 'insufficient_group_size',
        cancellation_reason_text = 'Group fell below minimum membership after a guest opt-out.',
        minimum_check_outcome = 'cancelled_minimum',
        updated_at = NOW()
    WHERE id = p_plan_id;

    UPDATE public.group_plan_opt_outs
    SET triggered_minimum_cancel = TRUE
    WHERE plan_id = p_plan_id AND user_id = _user_id;

    PERFORM public._refund_all_group_guests(p_plan_id, true);

    FOR _offer IN
      SELECT * FROM public.plan_offers
      WHERE plan_id = p_plan_id AND status = 'accepted'::public.offer_status
    LOOP
      PERFORM public.create_notification(
        _offer.bidder_id,
        'group_plan_cancelled_minimum',
        'Group Plan cancelled',
        'The group fell below the minimum of 5 members. Your contribution has been refunded in full.',
        jsonb_build_object('href', '/wallet', 'planId', p_plan_id::text),
        'high',
        'group_min_cancel:' || p_plan_id::text || ':' || _offer.bidder_id::text
      );
    END LOOP;

    PERFORM public.create_notification(
      _plan.creator_id,
      'group_plan_cancelled_minimum',
      'Group Plan cancelled',
      'Your group fell below the minimum membership after a guest opt-out. All contributions have been refunded.',
      jsonb_build_object('href', '/plan/' || p_plan_id, 'planId', p_plan_id::text),
      'high',
      'group_min_cancel_host:' || p_plan_id::text
    );

    RETURN jsonb_build_object(
      'opted_out', true,
      'triggered_minimum_cancel', true,
      'new_member_count', _new_count,
      'refund', _refund
    );
  END IF;

  FOR _offer IN
    SELECT * FROM public.plan_offers
    WHERE plan_id = p_plan_id AND status = 'accepted'::public.offer_status AND bidder_id <> _user_id
  LOOP
    PERFORM public.create_notification(
      _offer.bidder_id,
      'group_member_opted_out',
      'A member has opted out',
      'The group now has ' || _new_count || ' confirmed members.',
      jsonb_build_object('href', '/plan/' || p_plan_id, 'planId', p_plan_id::text),
      'medium',
      NULL
    );
  END LOOP;

  RETURN jsonb_build_object(
    'opted_out', true,
    'triggered_minimum_cancel', false,
    'new_member_count', _new_count,
    'refund', _refund
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_join_request(
  p_plan_id UUID,
  p_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _request_id UUID;
  _guest_name TEXT;
BEGIN
  IF _requester_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id = _requester_id THEN
    RAISE EXCEPTION 'host_cannot_request';
  END IF;

  IF NOT public.plan_allows_join_requests(_plan) THEN
    IF COALESCE(_plan.is_negotiable, true) THEN
      RAISE EXCEPTION 'plan_is_negotiable_use_offer_flow';
    END IF;
    RAISE EXCEPTION 'join_request_not_applicable';
  END IF;

  IF _plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_already_closed';
  END IF;

  IF COALESCE(_plan.is_group_plan, false) THEN
    IF public.get_plan_available_slots(p_plan_id) <= 0 THEN
      RAISE EXCEPTION 'plan_full';
    END IF;
  ELSE
    IF _plan.accepted_offer_id IS NOT NULL OR COALESCE(_plan.accepted_guest_count, 0) > 0 THEN
      RAISE EXCEPTION 'plan_full';
    END IF;
    IF _plan.status IN ('agreed', 'awaiting_payment', 'active', 'completed') THEN
      RAISE EXCEPTION 'plan_not_open';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_offers
    WHERE plan_id = p_plan_id
      AND bidder_id = _requester_id
      AND status = 'accepted'::public.offer_status
  ) THEN
    RAISE EXCEPTION 'guest_already_confirmed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_invitations
    WHERE plan_id = p_plan_id
      AND invitee_user_id = _requester_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'guest_already_confirmed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_join_requests
    WHERE plan_id = p_plan_id
      AND requester_id = _requester_id
      AND status IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'request_already_exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.escrow_transactions
    WHERE plan_id = p_plan_id AND guest_id = _requester_id
      AND status NOT IN ('cancelled', 'refunded')
  ) THEN
    RAISE EXCEPTION 'guest_already_has_escrow';
  END IF;

  INSERT INTO public.plan_join_requests (plan_id, requester_id, message)
  VALUES (p_plan_id, _requester_id, nullif(trim(p_message), ''))
  RETURNING id INTO _request_id;

  SELECT display_name INTO _guest_name FROM public.profiles WHERE user_id = _requester_id;

  PERFORM public.create_notification(
    _plan.creator_id,
    'join_request_received',
    'New join request',
    format('%s wants to join your plan.', COALESCE(_guest_name, 'Someone')),
    jsonb_build_object(
      'href', '/plan/' || p_plan_id::text || '/requests',
      'planId', p_plan_id::text,
      'requestId', _request_id::text,
      'requesterName', _guest_name
    ),
    'medium',
    NULL
  );

  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_offer_or_counter(
  p_plan_id UUID,
  p_amount_cents INTEGER,
  p_note TEXT DEFAULT NULL,
  p_proposed_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  p_offer_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_offer_id UUID;
  v_expires TIMESTAMPTZ := now() + interval '24 hours';
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF v_plan.status = 'cancelled' OR v_plan.group_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'plan_not_open';
  END IF;

  IF p_offer_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.plan_offers
      WHERE plan_id = p_plan_id
        AND bidder_id = v_guest_id
        AND status = 'accepted'::public.offer_status
    ) THEN
      RAISE EXCEPTION 'guest_already_confirmed';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.plan_join_requests
      WHERE plan_id = p_plan_id
        AND requester_id = v_guest_id
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'guest_already_confirmed';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.plan_invitations
      WHERE plan_id = p_plan_id
        AND invitee_user_id = v_guest_id
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'guest_already_confirmed';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.escrow_transactions
      WHERE plan_id = p_plan_id
        AND guest_id = v_guest_id
        AND status NOT IN ('cancelled', 'refunded')
    ) THEN
      RAISE EXCEPTION 'guest_already_confirmed';
    END IF;

    IF COALESCE(v_plan.is_group_plan, false) AND public.get_plan_available_slots(p_plan_id) <= 0 THEN
      RAISE EXCEPTION 'plan_full';
    END IF;
  END IF;

  IF p_offer_id IS NULL AND v_plan.is_group_plan THEN
    IF EXISTS (
      SELECT 1 FROM public.plan_offers
      WHERE plan_id = p_plan_id
        AND bidder_id = v_guest_id
        AND status IN ('pending', 'countered', 'countered_by_host', 'countered_by_guest', 'accepted')
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN
      RAISE EXCEPTION 'You already have an active slot request on this plan.';
    END IF;
  END IF;

  IF p_offer_id IS NULL THEN
    INSERT INTO public.plan_offers (
      plan_id, bidder_id, amount_cents, current_amount_cents, message,
      status, last_action_by, awaiting_response_from, round, expires_at, proposed_scheduled_at
    ) VALUES (
      p_plan_id, v_guest_id, p_amount_cents, p_amount_cents, p_note,
      'pending', 'guest', 'host',
      COALESCE((SELECT MAX(round) + 1 FROM public.plan_offers WHERE plan_id = p_plan_id), 1),
      v_expires, p_proposed_scheduled_at
    )
    RETURNING id INTO v_offer_id;

    PERFORM public._record_offer_round(v_offer_id, p_plan_id, v_guest_id, 'guest', 'offer', p_amount_cents, p_note);
  ELSE
    v_offer_id := p_offer_id;
    UPDATE public.plan_offers SET
      amount_cents = p_amount_cents,
      current_amount_cents = p_amount_cents,
      message = COALESCE(p_note, message),
      proposed_scheduled_at = COALESCE(p_proposed_scheduled_at, proposed_scheduled_at),
      status = 'countered_by_guest',
      last_action_by = 'guest',
      awaiting_response_from = 'host',
      updated_at = now()
    WHERE id = p_offer_id
      AND bidder_id = v_guest_id
      AND status = 'countered_by_host';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'cannot_counter';
    END IF;

    PERFORM public._record_offer_round(v_offer_id, p_plan_id, v_guest_id, 'guest', 'counter', p_amount_cents, p_note);
  END IF;

  PERFORM public.create_notification(
    v_plan.creator_id,
    'offer_received',
    CASE WHEN p_offer_id IS NULL THEN 'New offer received' ELSE 'Guest countered your offer' END,
    'Review and respond in Manage Offers.',
    jsonb_build_object('href', '/plan/' || p_plan_id || '/negotiate', 'planId', p_plan_id, 'offerId', v_offer_id)
  );

  RETURN v_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_opt_out(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_join_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_offer_or_counter(UUID, INTEGER, TEXT, TIMESTAMPTZ, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_join_requests_sync_group_guest_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND (
       NEW.status = 'approved'
       OR OLD.status = 'approved'
       OR NEW.status = 'declined'
     ) THEN
    PERFORM public.sync_group_plan_accepted_guest_count(NEW.plan_id);
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    PERFORM public.sync_group_plan_accepted_guest_count(NEW.plan_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_join_requests_sync_group_guest_count ON public.plan_join_requests;
CREATE TRIGGER trg_join_requests_sync_group_guest_count
  AFTER INSERT OR UPDATE OF status ON public.plan_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_join_requests_sync_group_guest_count();

NOTIFY pgrst, 'reload schema';
