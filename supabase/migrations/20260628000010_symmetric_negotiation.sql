-- Part 2/2: symmetric negotiation schema, backfill, RPCs.
-- Requires 20260628000009_symmetric_negotiation_enum.sql to be committed first.

ALTER TABLE public.plan_offers
  ADD COLUMN IF NOT EXISTS current_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS last_action_by TEXT,
  ADD COLUMN IF NOT EXISTS awaiting_response_from TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.plan_offers DROP CONSTRAINT IF EXISTS plan_offers_last_action_by_check;
ALTER TABLE public.plan_offers ADD CONSTRAINT plan_offers_last_action_by_check
  CHECK (last_action_by IS NULL OR last_action_by IN ('host', 'guest'));

ALTER TABLE public.plan_offers DROP CONSTRAINT IF EXISTS plan_offers_awaiting_response_from_check;
ALTER TABLE public.plan_offers ADD CONSTRAINT plan_offers_awaiting_response_from_check
  CHECK (awaiting_response_from IS NULL OR awaiting_response_from IN ('host', 'guest'));

UPDATE public.plan_offers
SET current_amount_cents = amount_cents
WHERE current_amount_cents IS NULL;

UPDATE public.plan_offers
SET awaiting_response_from = 'host',
    last_action_by = COALESCE(last_action_by, 'guest')
WHERE status = 'pending'::public.offer_status
  AND awaiting_response_from IS NULL;

UPDATE public.plan_offers
SET awaiting_response_from = 'guest',
    last_action_by = COALESCE(last_action_by, 'host')
WHERE status IN ('countered'::public.offer_status, 'countered_by_host'::public.offer_status)
  AND awaiting_response_from IS NULL;

UPDATE public.plan_offers
SET awaiting_response_from = 'host',
    last_action_by = COALESCE(last_action_by, 'guest')
WHERE status = 'countered_by_guest'::public.offer_status
  AND awaiting_response_from IS NULL;

CREATE TABLE IF NOT EXISTS public.plan_offer_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.plan_offers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES public.users(id),
  proposer_role TEXT NOT NULL CHECK (proposer_role IN ('host', 'guest')),
  action TEXT NOT NULL CHECK (action IN ('offer', 'counter', 'accept', 'decline', 'withdraw')),
  amount_cents INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_offer_rounds_offer_id
  ON public.plan_offer_rounds(offer_id, created_at);

ALTER TABLE public.plan_offer_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offer_parties_read_rounds ON public.plan_offer_rounds;
CREATE POLICY offer_parties_read_rounds ON public.plan_offer_rounds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plan_offers o
      JOIN public.plans p ON p.id = o.plan_id
      WHERE o.id = plan_offer_rounds.offer_id
        AND (o.bidder_id = auth.uid() OR p.creator_id = auth.uid())
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_offer_rounds;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._record_offer_round(
  p_offer_id UUID,
  p_plan_id UUID,
  p_proposer_id UUID,
  p_proposer_role TEXT,
  p_action TEXT,
  p_amount_cents INTEGER DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.plan_offer_rounds (
    offer_id, plan_id, proposer_id, proposer_role, action, amount_cents, note
  ) VALUES (
    p_offer_id, p_plan_id, p_proposer_id, p_proposer_role, p_action, p_amount_cents, p_note
  );
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

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
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

CREATE OR REPLACE FUNCTION public.host_respond_to_offer(
  p_offer_id UUID,
  p_action TEXT,
  p_counter_amount_cents INTEGER DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_proposed_scheduled_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.plan_offers%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_host_id UUID := auth.uid();
  v_agreed_amount INTEGER;
  v_merged_schedule TIMESTAMPTZ;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_offer FROM public.plan_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_offer.plan_id FOR UPDATE;
  IF v_plan.creator_id != v_host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF v_offer.awaiting_response_from IS DISTINCT FROM 'host' THEN
    RAISE EXCEPTION 'not_your_turn';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.plan_offers SET
      status = 'accepted',
      last_action_by = 'host',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    IF COALESCE(v_plan.is_group_plan, false) THEN
      UPDATE public.plans SET
        status = 'negotiating',
        accepted_guest_count = COALESCE(accepted_guest_count, 0) + 1,
        updated_at = now()
      WHERE id = v_plan.id;
    ELSE
      UPDATE public.plan_offers SET status = 'superseded'
      WHERE plan_id = v_plan.id AND id <> p_offer_id
        AND status IN ('pending', 'countered', 'countered_by_host', 'countered_by_guest');

      v_agreed_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, v_plan.starting_price_cents, 0);
      v_merged_schedule := COALESCE(p_proposed_scheduled_at, v_offer.proposed_scheduled_at, v_plan.scheduled_at);

      UPDATE public.plans SET
        status = 'agreed',
        accepted_offer_id = p_offer_id,
        agreed_price_cents = CASE WHEN v_agreed_amount > 0 THEN v_agreed_amount ELSE NULL END,
        agreed_scheduled_at = v_merged_schedule,
        agreed_location = COALESCE(v_plan.location_label, agreed_location),
        agreed_notes = COALESCE(v_offer.message, agreed_notes),
        scheduled_at = COALESCE(v_merged_schedule, scheduled_at),
        updated_at = now()
      WHERE id = v_plan.id;
    END IF;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_accepted',
      'Your offer was accepted!',
      'Review the agreement and proceed to secure payment when ready.',
      jsonb_build_object('href', '/plan/' || v_plan.id || '/agreement', 'planId', v_plan.id, 'offerId', p_offer_id)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'accept', NULL, p_note);

  ELSIF p_action = 'counter' THEN
    IF p_counter_amount_cents IS NULL THEN
      RAISE EXCEPTION 'counter_amount_required';
    END IF;

    UPDATE public.plan_offers SET
      amount_cents = p_counter_amount_cents,
      current_amount_cents = p_counter_amount_cents,
      message = COALESCE(p_note, message),
      proposed_scheduled_at = COALESCE(p_proposed_scheduled_at, proposed_scheduled_at),
      status = 'countered_by_host',
      last_action_by = 'host',
      awaiting_response_from = 'guest',
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_countered',
      'The host made a counter offer',
      'Review their counter and respond.',
      jsonb_build_object('href', '/plan/' || v_plan.id || '/negotiate', 'planId', v_plan.id, 'offerId', p_offer_id)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'counter', p_counter_amount_cents, p_note);

  ELSIF p_action = 'decline' THEN
    UPDATE public.plan_offers SET
      status = 'declined',
      last_action_by = 'host',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_offer.bidder_id,
      'offer_declined',
      'Your offer was not accepted',
      'You can submit a new offer or explore other plans.',
      jsonb_build_object('href', '/plan/' || v_plan.id, 'planId', v_plan.id)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_host_id, 'host', 'decline', NULL, p_note);
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_respond_to_counter(
  p_offer_id UUID,
  p_action TEXT,
  p_counter_amount_cents INTEGER DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_proposed_scheduled_at TIMESTAMPTZ DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.plan_offers%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_guest_id UUID := auth.uid();
  v_agreed_amount INTEGER;
  v_merged_schedule TIMESTAMPTZ;
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_offer FROM public.plan_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_offer.plan_id FOR UPDATE;

  IF v_offer.bidder_id != v_guest_id THEN
    RAISE EXCEPTION 'not_offer_owner';
  END IF;

  IF v_offer.awaiting_response_from IS DISTINCT FROM 'guest' THEN
    RAISE EXCEPTION 'not_your_turn';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.plan_offers SET
      status = 'accepted',
      last_action_by = 'guest',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    IF COALESCE(v_plan.is_group_plan, false) THEN
      UPDATE public.plans SET
        status = 'negotiating',
        accepted_guest_count = COALESCE(accepted_guest_count, 0) + 1,
        updated_at = now()
      WHERE id = v_plan.id;
    ELSE
      UPDATE public.plan_offers SET status = 'superseded'
      WHERE plan_id = v_plan.id AND id <> p_offer_id
        AND status IN ('pending', 'countered', 'countered_by_host', 'countered_by_guest');

      v_agreed_amount := COALESCE(v_offer.current_amount_cents, v_offer.amount_cents, v_plan.starting_price_cents, 0);
      v_merged_schedule := COALESCE(p_proposed_scheduled_at, v_offer.proposed_scheduled_at, v_plan.scheduled_at);

      UPDATE public.plans SET
        status = 'agreed',
        accepted_offer_id = p_offer_id,
        agreed_price_cents = CASE WHEN v_agreed_amount > 0 THEN v_agreed_amount ELSE NULL END,
        agreed_scheduled_at = v_merged_schedule,
        agreed_location = COALESCE(v_plan.location_label, agreed_location),
        agreed_notes = COALESCE(v_offer.message, agreed_notes),
        scheduled_at = COALESCE(v_merged_schedule, scheduled_at),
        updated_at = now()
      WHERE id = v_plan.id;
    END IF;

    PERFORM public.create_notification(
      v_plan.creator_id,
      'offer_accepted',
      'The guest accepted your counter!',
      'Both parties agreed. Review the agreement next.',
      jsonb_build_object('href', '/plan/' || v_plan.id || '/agreement', 'planId', v_plan.id, 'offerId', p_offer_id)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_guest_id, 'guest', 'accept', NULL, p_note);

  ELSIF p_action = 'counter' THEN
    IF p_counter_amount_cents IS NULL THEN
      RAISE EXCEPTION 'counter_amount_required';
    END IF;

    PERFORM public.submit_offer_or_counter(
      v_plan.id,
      p_counter_amount_cents,
      p_note,
      p_proposed_scheduled_at,
      p_offer_id
    );

  ELSIF p_action = 'decline' THEN
    UPDATE public.plan_offers SET
      status = 'declined',
      last_action_by = 'guest',
      awaiting_response_from = NULL,
      updated_at = now()
    WHERE id = p_offer_id;

    PERFORM public.create_notification(
      v_plan.creator_id,
      'offer_declined',
      'The guest declined your counter',
      'The negotiation has ended.',
      jsonb_build_object('href', '/plan/' || v_plan.id || '/negotiate', 'planId', v_plan.id)
    );

    PERFORM public._record_offer_round(p_offer_id, v_plan.id, v_guest_id, 'guest', 'decline', NULL, p_note);
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_offer(p_offer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.plan_offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.plan_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found';
  END IF;

  IF v_offer.bidder_id != auth.uid() THEN
    RAISE EXCEPTION 'not_offer_owner';
  END IF;

  IF v_offer.status NOT IN (
    'pending'::public.offer_status,
    'countered_by_guest'::public.offer_status
  ) OR v_offer.awaiting_response_from IS DISTINCT FROM 'host' THEN
    RAISE EXCEPTION 'cannot_withdraw_at_this_stage';
  END IF;

  UPDATE public.plan_offers SET
    status = 'withdrawn',
    awaiting_response_from = NULL,
    updated_at = now()
  WHERE id = p_offer_id;

  PERFORM public._record_offer_round(
    p_offer_id, v_offer.plan_id, auth.uid(), 'guest', 'withdraw', NULL, NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_offer_or_counter(UUID, INTEGER, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_offer_or_counter(UUID, INTEGER, TEXT, TIMESTAMPTZ, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.host_respond_to_offer(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_respond_to_offer(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.guest_respond_to_counter(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_respond_to_counter(UUID, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.withdraw_offer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_offer(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
