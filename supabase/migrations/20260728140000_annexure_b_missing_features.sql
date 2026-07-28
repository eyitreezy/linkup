-- Annexure B v2 missing features: chat log consent, live location, group minimum,
-- countdown crons, guest opt-out, platform fee refunds, host cancellation, matrix 7.4.

-- -----------------------------------------------------------------------------
-- Enum: guest opt-out on group plans
-- -----------------------------------------------------------------------------
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'opted_out';

-- -----------------------------------------------------------------------------
-- 1. Chat log consent (Section 3.4)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispute_chat_log_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id),
  consented BOOLEAN NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dispute_id, user_id)
);

ALTER TABLE public.dispute_chat_log_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_chat_consent ON public.dispute_chat_log_consents;
CREATE POLICY users_manage_own_chat_consent
  ON public.dispute_chat_log_consents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS admin_read_chat_consents ON public.dispute_chat_log_consents;
CREATE POLICY admin_read_chat_consents
  ON public.dispute_chat_log_consents FOR SELECT
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS chat_log_access TEXT
    CHECK (chat_log_access IN ('full', 'partial', 'none', 'pending'))
    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS chat_log_access_resolved_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.resolve_dispute_chat_log_access(p_dispute_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute public.disputes%ROWTYPE;
  v_reporter BOOLEAN;
  v_reported BOOLEAN;
  v_reporter_done BOOLEAN := false;
  v_reported_done BOOLEAN := false;
  v_access TEXT := 'pending';
BEGIN
  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT c.consented INTO v_reporter
  FROM public.dispute_chat_log_consents c
  WHERE c.dispute_id = p_dispute_id AND c.user_id = v_dispute.reporter_id;
  v_reporter_done := FOUND;

  SELECT c.consented INTO v_reported
  FROM public.dispute_chat_log_consents c
  WHERE c.dispute_id = p_dispute_id AND c.user_id = v_dispute.reported_user_id;
  v_reported_done := FOUND;

  IF NOT v_reporter_done OR NOT v_reported_done THEN
    v_access := 'pending';
  ELSIF COALESCE(v_reporter, false) AND COALESCE(v_reported, false) THEN
    v_access := 'full';
  ELSIF COALESCE(v_reporter, false) OR COALESCE(v_reported, false) THEN
    v_access := 'partial';
  ELSE
    v_access := 'none';
  END IF;

  UPDATE public.disputes
  SET chat_log_access = v_access,
      chat_log_access_resolved_at = CASE
        WHEN v_access = 'pending' THEN chat_log_access_resolved_at
        ELSE NOW()
      END,
      updated_at = NOW()
  WHERE id = p_dispute_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dispute_chat_consent_resolve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.resolve_dispute_chat_log_access(
    COALESCE(NEW.dispute_id, OLD.dispute_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_chat_consent_resolve ON public.dispute_chat_log_consents;
CREATE TRIGGER trg_dispute_chat_consent_resolve
  AFTER INSERT OR UPDATE ON public.dispute_chat_log_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_dispute_chat_consent_resolve();

-- -----------------------------------------------------------------------------
-- 2. Live location sessions (Section 3.5)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_location_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  sharer_id UUID NOT NULL REFERENCES public.users (id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL CHECK (duration_minutes IN (15, 60, -1)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS live_location_sessions_one_active_per_user
  ON public.live_location_sessions (plan_id, sharer_id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.live_location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_location_sessions (id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_location_pings_session
  ON public.live_location_pings (session_id, pinged_at DESC);

ALTER TABLE public.live_location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_location_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_participants_read_sessions ON public.live_location_sessions;
CREATE POLICY plan_participants_read_sessions
  ON public.live_location_sessions FOR SELECT
  USING (
    sharer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_id AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.plan_offers po
      WHERE po.plan_id = live_location_sessions.plan_id
        AND po.bidder_id = auth.uid()
        AND po.status = 'accepted'::public.offer_status
    )
  );

DROP POLICY IF EXISTS sharer_insert_session ON public.live_location_sessions;
CREATE POLICY sharer_insert_session
  ON public.live_location_sessions FOR INSERT
  WITH CHECK (sharer_id = auth.uid());

DROP POLICY IF EXISTS sharer_update_own_session ON public.live_location_sessions;
CREATE POLICY sharer_update_own_session
  ON public.live_location_sessions FOR UPDATE
  USING (sharer_id = auth.uid());

DROP POLICY IF EXISTS plan_participants_read_pings ON public.live_location_pings;
CREATE POLICY plan_participants_read_pings
  ON public.live_location_pings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_location_sessions s
      WHERE s.id = session_id
        AND (
          s.sharer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.plans p
            WHERE p.id = s.plan_id AND p.creator_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.plan_offers po
            WHERE po.plan_id = s.plan_id
              AND po.bidder_id = auth.uid()
              AND po.status = 'accepted'::public.offer_status
          )
        )
    )
  );

DROP POLICY IF EXISTS sharer_insert_pings ON public.live_location_pings;
CREATE POLICY sharer_insert_pings
  ON public.live_location_pings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_location_sessions s
      WHERE s.id = session_id
        AND s.sharer_id = auth.uid()
        AND s.is_active = TRUE
    )
  );

CREATE TABLE IF NOT EXISTS public.live_location_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.live_location_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_location_consent ON public.live_location_consents;
CREATE POLICY users_manage_own_location_consent
  ON public.live_location_consents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_location_pings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_location_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Group minimum membership (Section 4.1) — uses accepted_guest_count
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS minimum_member_count INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS minimum_check_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_minimum_response_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS minimum_check_outcome TEXT
    CHECK (minimum_check_outcome IN (
      'extend_registration', 'proceed_smaller', 'cancelled_minimum'
    ));

-- -----------------------------------------------------------------------------
-- 4. Guest opt-out (Section 4.3)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_plan_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id),
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contribution_amount_cents INT NOT NULL,
  platform_fee_refunded_cents INT NOT NULL,
  triggered_minimum_cancel BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (plan_id, user_id)
);

ALTER TABLE public.group_plan_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_opt_out ON public.group_plan_opt_outs;
CREATE POLICY users_read_own_opt_out
  ON public.group_plan_opt_outs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_manage_opt_outs ON public.group_plan_opt_outs;
CREATE POLICY admin_manage_opt_outs
  ON public.group_plan_opt_outs FOR ALL
  USING (public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. Host group cancellation metadata (Sections 5.1, 5.2)
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS cancellation_reason_type TEXT
    CHECK (cancellation_reason_type IN (
      'logistical_issue', 'personal_emergency',
      'insufficient_group_size', 'venue_issue', 'other'
    )),
  ADD COLUMN IF NOT EXISTS cancellation_reason_text TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_timing_band TEXT
    CHECK (cancellation_timing_band IN (
      '72h_plus', '48_72h', '24_48h', 'within_24h',
      'no_show_emergency', 'no_show_no_contact'
    )),
  ADD COLUMN IF NOT EXISTS cancellation_host_refund_percent INT,
  ADD COLUMN IF NOT EXISTS cancellation_guest_penalty_percent INT;

-- -----------------------------------------------------------------------------
-- 6. Cancellation matrix (Section 7.4)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancellation_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('standard', 'mood', 'group')),
  escrow_pattern TEXT NOT NULL CHECK (escrow_pattern IN ('A', 'B', 'C')),
  timing_band TEXT NOT NULL CHECK (timing_band IN (
    '72h_plus', '48_72h', '24_48h', 'within_24h',
    'no_show_emergency', 'no_show_no_contact'
  )),
  cancelling_party TEXT NOT NULL CHECK (cancelling_party IN ('host', 'guest', 'either')),
  canceller_refund_percent INT NOT NULL,
  other_party_penalty_percent INT NOT NULL,
  other_party_goodwill_credit TEXT CHECK (other_party_goodwill_credit IN (
    'none', 'standard', 'enhanced'
  )) DEFAULT 'none',
  trust_strikes INT NOT NULL DEFAULT 0,
  visibility_reduction_percent INT NOT NULL DEFAULT 0,
  visibility_reduction_days INT NOT NULL DEFAULT 0,
  creation_hold_days INT NOT NULL DEFAULT 0,
  requires_admin_review BOOLEAN NOT NULL DEFAULT FALSE,
  early_cancel_count_threshold INT,
  UNIQUE (plan_type, escrow_pattern, timing_band, cancelling_party)
);

ALTER TABLE public.cancellation_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cancellation_matrix_public_read ON public.cancellation_matrix;
CREATE POLICY cancellation_matrix_public_read
  ON public.cancellation_matrix FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.cancellation_matrix (
  plan_type, escrow_pattern, timing_band, cancelling_party,
  canceller_refund_percent, other_party_penalty_percent,
  other_party_goodwill_credit, trust_strikes,
  visibility_reduction_percent, visibility_reduction_days,
  creation_hold_days, requires_admin_review, early_cancel_count_threshold
) VALUES
  ('standard','A','72h_plus','host',         100, 0,  'none',     0, 0,  0,  0,  false, 3),
  ('standard','A','48_72h','host',            80,  20, 'standard', 1, 20, 30, 0,  false, null),
  ('standard','A','24_48h','host',            70,  30, 'standard', 1, 40, 30, 7,  false, null),
  ('standard','A','within_24h','host',        60,  40, 'enhanced', 2, 0,  0,  14, true,  null),
  ('standard','A','no_show_emergency','host', 65,  35, 'standard', 1, 0,  0,  0,  false, null),
  ('standard','A','no_show_no_contact','host',50,  50, 'enhanced', 2, 0,  0,  0,  true,  null),
  ('mood','A','72h_plus','host',              100, 0,  'none',     0, 0,  0,  0,  false, 3),
  ('mood','A','48_72h','host',                80,  20, 'standard', 1, 20, 30, 0,  false, null),
  ('mood','A','24_48h','host',                70,  30, 'standard', 1, 40, 30, 7,  false, null),
  ('mood','A','within_24h','host',            60,  40, 'enhanced', 2, 0,  0,  14, true,  null),
  ('mood','A','no_show_emergency','host',     65,  35, 'standard', 1, 0,  0,  0,  false, null),
  ('mood','A','no_show_no_contact','host',    50,  50, 'enhanced', 2, 0,  0,  0,  true,  null),
  ('standard','B','72h_plus','either',         100, 0,  'none',     0, 0,  0,  0,  false, 3),
  ('standard','B','48_72h','either',            80,  20, 'standard', 1, 20, 30, 0,  false, null),
  ('standard','B','24_48h','either',            70,  30, 'standard', 1, 40, 30, 7,  false, null),
  ('standard','B','within_24h','either',        60,  40, 'enhanced', 2, 0,  0,  14, true,  null),
  ('standard','B','no_show_emergency','either', 65,  35, 'standard', 1, 0,  0,  0,  false, null),
  ('standard','B','no_show_no_contact','either',50,  50, 'enhanced', 2, 0,  0,  0,  true,  null),
  ('mood','B','72h_plus','either',              100, 0,  'none',     0, 0,  0,  0,  false, 3),
  ('mood','B','48_72h','either',                80,  20, 'standard', 1, 20, 30, 0,  false, null),
  ('mood','B','24_48h','either',                70,  30, 'standard', 1, 40, 30, 7,  false, null),
  ('mood','B','within_24h','either',            60,  40, 'enhanced', 2, 0,  0,  14, true,  null),
  ('mood','B','no_show_emergency','either',     65,  35, 'standard', 1, 0,  0,  0,  false, null),
  ('mood','B','no_show_no_contact','either',    50,  50, 'enhanced', 2, 0,  0,  0,  true,  null),
  ('group','A','72h_plus','host',         100, 0,  'none',     0, 0,  0,  0,  false, 3),
  ('group','A','48_72h','host',            80,  20, 'standard', 1, 20, 30, 0,  false, null),
  ('group','A','24_48h','host',            70,  30, 'standard', 1, 40, 30, 7,  false, null),
  ('group','A','within_24h','host',        60,  40, 'enhanced', 2, 0,  0,  14, true,  null),
  ('group','A','no_show_emergency','host', 65,  35, 'standard', 1, 0,  0,  0,  false, null),
  ('group','A','no_show_no_contact','host',50,  50, 'enhanced', 2, 0,  0,  0,  true,  null)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._plan_type_label(p_plan public.plans)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_plan.is_group_plan, false) THEN 'group'
    WHEN COALESCE(p_plan.is_mood_plan, false) THEN 'mood'
    ELSE 'standard'
  END;
$$;

CREATE OR REPLACE FUNCTION public._cancellation_timing_band(p_hours_until NUMERIC, p_no_show BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_no_show THEN
    RETURN 'no_show_no_contact';
  END IF;
  IF p_hours_until >= 72 THEN RETURN '72h_plus'; END IF;
  IF p_hours_until >= 48 THEN RETURN '48_72h'; END IF;
  IF p_hours_until >= 24 THEN RETURN '24_48h'; END IF;
  IF p_hours_until >= 0 THEN RETURN 'within_24h'; END IF;
  RETURN 'no_show_no_contact';
END;
$$;

CREATE OR REPLACE FUNCTION public._apply_user_strikes(p_user_id UUID, p_strikes INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_strikes <= 0 OR p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_strikes (user_id, strike_count, last_strike_at)
  VALUES (p_user_id, p_strikes, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET strike_count = public.user_strikes.strike_count + EXCLUDED.strike_count,
      last_strike_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public._refund_group_guest_escrow(
  p_plan_id UUID,
  p_user_id UUID,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.escrow_transactions%ROWTYPE;
  v_credit INT;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = p_user_id
    AND status IN ('funded', 'active', 'held')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_escrow');
  END IF;

  v_credit := COALESCE(v_escrow.amount_cents, 0);
  IF NOT p_refund_platform_fee THEN
    v_credit := v_credit - COALESCE(v_escrow.platform_fee_cents, public.platform_fee_cents_for_amount(v_credit));
    IF v_credit < 0 THEN v_credit := 0; END IF;
  END IF;

  v_ref := 'group_refund:' || p_plan_id::text || ':' || p_user_id::text || ':' || v_escrow.id::text;

  IF v_credit > 0 THEN
    PERFORM public._wallet_credit_internal(
      p_user_id,
      v_credit,
      'escrow_release',
      v_ref,
      jsonb_build_object('plan_id', p_plan_id, 'escrow_id', v_escrow.id)
    );
    PERFORM public._queue_wallet_credit_by_reference(v_ref);
  END IF;

  UPDATE public.escrow_transactions
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = v_escrow.id;

  RETURN jsonb_build_object(
    'refunded', true,
    'amount_cents', v_credit,
    'escrow_id', v_escrow.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._refund_all_group_guests(
  p_plan_id UUID,
  p_refund_platform_fee BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest UUID;
BEGIN
  FOR v_guest IN
    SELECT po.bidder_id
    FROM public.plan_offers po
    WHERE po.plan_id = p_plan_id
      AND po.status = 'accepted'::public.offer_status
  LOOP
    PERFORM public._refund_group_guest_escrow(p_plan_id, v_guest, p_refund_platform_fee);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- get_cancellation_terms (Section 5.2, 7.4)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cancellation_terms(
  p_plan_id UUID,
  p_cancelling_party TEXT DEFAULT 'host',
  p_no_show BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _hours_until NUMERIC;
  _timing_band TEXT;
  _matrix public.cancellation_matrix%ROWTYPE;
  _plan_type TEXT;
  _pattern TEXT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  _hours_until := EXTRACT(EPOCH FROM (COALESCE(_plan.agreed_scheduled_at, _plan.scheduled_at, NOW()) - NOW())) / 3600;
  _timing_band := public._cancellation_timing_band(_hours_until, p_no_show);
  _plan_type := public._plan_type_label(_plan);
  _pattern := COALESCE(_plan.escrow_pattern, 'A');

  SELECT * INTO _matrix
  FROM public.cancellation_matrix
  WHERE plan_type = _plan_type
    AND escrow_pattern = _pattern
    AND timing_band = _timing_band
    AND cancelling_party IN (p_cancelling_party, 'either')
  ORDER BY CASE WHEN cancelling_party = p_cancelling_party THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_matrix_entry_found';
  END IF;

  RETURN jsonb_build_object(
    'timing_band', _timing_band,
    'hours_until_meetup', ROUND(_hours_until::NUMERIC, 1),
    'canceller_refund_percent', _matrix.canceller_refund_percent,
    'other_party_penalty_percent', _matrix.other_party_penalty_percent,
    'other_party_goodwill_credit', _matrix.other_party_goodwill_credit,
    'trust_strikes', _matrix.trust_strikes,
    'visibility_reduction_percent', _matrix.visibility_reduction_percent,
    'visibility_reduction_days', _matrix.visibility_reduction_days,
    'creation_hold_days', _matrix.creation_hold_days,
    'requires_admin_review', _matrix.requires_admin_review,
    'escrow_pattern', _pattern,
    'plan_type', _plan_type,
    'is_group_plan', COALESCE(_plan.is_group_plan, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cancellation_terms(UUID, TEXT, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- submit_guest_opt_out (Section 4.3)
-- -----------------------------------------------------------------------------
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
  _hours_until NUMERIC;
  _new_count INT;
  _fee INT;
  _refund JSONB;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_a_group_plan'; END IF;

  _hours_until := EXTRACT(EPOCH FROM (COALESCE(_plan.scheduled_at, NOW()) - NOW())) / 3600;
  IF _hours_until < 48 THEN
    RAISE EXCEPTION 'opt_out_window_closed';
  END IF;

  SELECT * INTO _offer
  FROM public.plan_offers
  WHERE plan_id = p_plan_id AND bidder_id = _user_id AND status = 'accepted'::public.offer_status
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_plan_opt_outs WHERE plan_id = p_plan_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'already_opted_out';
  END IF;

  _fee := public.platform_fee_cents_for_amount(COALESCE(_offer.amount_cents, 0));

  INSERT INTO public.group_plan_opt_outs (
    plan_id, user_id, contribution_amount_cents, platform_fee_refunded_cents
  ) VALUES (
    p_plan_id, _user_id, COALESCE(_offer.amount_cents, 0), _fee
  );

  _refund := public._refund_group_guest_escrow(p_plan_id, _user_id, true);

  UPDATE public.plan_offers
  SET status = 'opted_out'::public.offer_status
  WHERE id = _offer.id;

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

GRANT EXECUTE ON FUNCTION public.submit_guest_opt_out(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- submit_host_minimum_action (Section 4.1)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_host_minimum_action(
  p_plan_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('extend_registration', 'proceed_smaller', 'cancel') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF _plan.creator_id <> _user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_a_group_plan'; END IF;

  IF p_action = 'cancel' THEN
    UPDATE public.plans
    SET status = 'cancelled',
        minimum_check_outcome = 'cancelled_minimum',
        cancellation_reason_type = 'insufficient_group_size',
        cancellation_reason_text = 'Host cancelled due to insufficient group size.',
        updated_at = NOW()
    WHERE id = p_plan_id;

    PERFORM public._refund_all_group_guests(p_plan_id, true);

    RETURN jsonb_build_object('action', p_action, 'cancelled', true);
  END IF;

  UPDATE public.plans
  SET minimum_check_outcome = p_action,
      host_minimum_response_deadline = NULL,
      updated_at = NOW()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object('action', p_action, 'cancelled', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_host_minimum_action(UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- submit_group_host_cancellation (Sections 5.1, 5.2)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_group_host_cancellation(
  p_plan_id UUID,
  p_reason_type TEXT,
  p_reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _terms JSONB;
  _guest RECORD;
  _goodwill TEXT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF _plan.creator_id <> _user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT COALESCE(_plan.is_group_plan, false) THEN RAISE EXCEPTION 'not_a_group_plan'; END IF;

  _terms := public.get_cancellation_terms(p_plan_id, 'host', false);

  UPDATE public.plans
  SET status = 'cancelled',
      cancellation_reason_type = p_reason_type,
      cancellation_reason_text = p_reason_text,
      cancellation_timing_band = _terms->>'timing_band',
      cancellation_host_refund_percent = (_terms->>'canceller_refund_percent')::int,
      cancellation_guest_penalty_percent = (_terms->>'other_party_penalty_percent')::int,
      updated_at = NOW()
  WHERE id = p_plan_id;

  PERFORM public._apply_user_strikes(_user_id, COALESCE((_terms->>'trust_strikes')::int, 0));
  PERFORM public._refund_all_group_guests(p_plan_id, true);

  _goodwill := COALESCE(_terms->>'other_party_goodwill_credit', 'none');

  FOR _guest IN
    SELECT bidder_id FROM public.plan_offers
    WHERE plan_id = p_plan_id AND status = 'accepted'::public.offer_status
  LOOP
    PERFORM public.create_notification(
      _guest.bidder_id,
      'group_plan_host_cancelled',
      'Group Plan cancelled by host',
      'The host has cancelled your group meetup. Your full contribution has been refunded.'
        || CASE WHEN _goodwill <> 'none' THEN ' A Goodwill Credit has been added to your wallet.' ELSE '' END,
      jsonb_build_object('href', '/wallet', 'planId', p_plan_id::text),
      'high',
      NULL
    );
  END LOOP;

  RETURN jsonb_build_object('cancelled', true, 'terms', _terms);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_group_host_cancellation(UUID, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- pg_cron: group countdown + minimum checks (Section 4.1, 4.2)
-- -----------------------------------------------------------------------------
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-countdown-7day') THEN
    PERFORM cron.unschedule('group-countdown-7day');
  END IF;
  PERFORM cron.schedule(
    'group-countdown-7day',
    '0 9 * * *',
    $job$
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT po.bidder_id,
      'group_countdown_7day',
      'Group Meetup in ' || CEIL(EXTRACT(EPOCH FROM (p.scheduled_at - NOW())) / 86400) || ' days',
      'Your group meetup is coming up. Current members: ' || p.accepted_guest_count || '. Make sure your plans are confirmed.',
      jsonb_build_object('href', '/plan/' || p.id, 'planId', p.id::text)
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'::public.offer_status
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND p.scheduled_at - NOW() BETWEEN INTERVAL '3 days' AND INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = po.bidder_id
          AND n.type = 'group_countdown_7day'
          AND (n.data->>'planId') = p.id::text
          AND n.created_at > NOW() - INTERVAL '3 days'
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-countdown-48h-morning') THEN
    PERFORM cron.unschedule('group-countdown-48h-morning');
  END IF;
  PERFORM cron.schedule(
    'group-countdown-48h-morning',
    '0 8,18 * * *',
    $job$
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT po.bidder_id,
      'group_countdown_48h',
      '2 days to your Group Meetup',
      '2 days to your group meetup. Confirm your plans are in order. Last window to opt out with a full refund ends at 48 hours before meetup.',
      jsonb_build_object('href', '/plan/' || p.id, 'planId', p.id::text)
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'::public.offer_status
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND p.scheduled_at - NOW() BETWEEN INTERVAL '47 hours' AND INTERVAL '49 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = po.bidder_id
          AND n.type = 'group_countdown_48h'
          AND (n.data->>'planId') = p.id::text
          AND n.created_at > NOW() - INTERVAL '12 hours'
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-countdown-24h') THEN
    PERFORM cron.unschedule('group-countdown-24h');
  END IF;
  PERFORM cron.schedule(
    'group-countdown-24h',
    '0 */8 * * *',
    $job$
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT po.bidder_id,
      'group_countdown_24h',
      '24 hours to your Group Meetup',
      '24 hours to your group meetup. This is your last window to opt out with a full refund.',
      jsonb_build_object('href', '/plan/' || p.id, 'planId', p.id::text)
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'::public.offer_status
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND p.scheduled_at - NOW() BETWEEN INTERVAL '23 hours' AND INTERVAL '25 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = po.bidder_id
          AND n.type = 'group_countdown_24h'
          AND (n.data->>'planId') = p.id::text
          AND n.created_at > NOW() - INTERVAL '8 hours'
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-countdown-6h') THEN
    PERFORM cron.unschedule('group-countdown-6h');
  END IF;
  PERFORM cron.schedule(
    'group-countdown-6h',
    '0 */2 * * *',
    $job$
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT po.bidder_id,
      'group_countdown_6h',
      'Your Group Meetup is in 6 hours',
      'Travel reminder. Venue: ' || COALESCE(p.location_label, 'see plan details') || '. Tap to get directions.',
      jsonb_build_object(
        'href', '/plan/' || p.id,
        'planId', p.id::text,
        'location', p.location_label,
        'lat', p.latitude,
        'lng', p.longitude
      )
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'::public.offer_status
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND p.scheduled_at - NOW() BETWEEN INTERVAL '5 hours 50 minutes' AND INTERVAL '6 hours 10 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = po.bidder_id
          AND n.type = 'group_countdown_6h'
          AND (n.data->>'planId') = p.id::text
          AND n.created_at > NOW() - INTERVAL '2 hours'
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-countdown-1h') THEN
    PERFORM cron.unschedule('group-countdown-1h');
  END IF;
  PERFORM cron.schedule(
    'group-countdown-1h',
    '*/5 * * * *',
    $job$
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT po.bidder_id,
      'group_countdown_1h',
      'Your Group Meetup begins in 1 hour',
      'Please begin your journey if you have not already. Tap I Have Arrived when you reach the venue.',
      jsonb_build_object('href', '/plan/' || p.id, 'planId', p.id::text)
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'::public.offer_status
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND p.scheduled_at - NOW() BETWEEN INTERVAL '55 minutes' AND INTERVAL '65 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = po.bidder_id
          AND n.type = 'group_countdown_1h'
          AND (n.data->>'planId') = p.id::text
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-countdown-meetup') THEN
    PERFORM cron.unschedule('group-countdown-meetup');
  END IF;
  PERFORM cron.schedule(
    'group-countdown-meetup',
    '*/5 * * * *',
    $job$
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT po.bidder_id,
      'group_meetup_started',
      'Your Group Meetup has started',
      'Tap I Have Arrived when you reach the venue.',
      jsonb_build_object('href', '/plan/' || p.id, 'planId', p.id::text)
    FROM public.plans p
    JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'::public.offer_status
    WHERE COALESCE(p.is_group_plan, false)
      AND p.status = 'active'
      AND p.scheduled_at BETWEEN NOW() - INTERVAL '5 minutes' AND NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = po.bidder_id
          AND n.type = 'group_meetup_started'
          AND (n.data->>'planId') = p.id::text
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-minimum-membership-check') THEN
    PERFORM cron.unschedule('group-minimum-membership-check');
  END IF;
  PERFORM cron.schedule(
    'group-minimum-membership-check',
    '*/15 * * * *',
    $job$
    WITH flagged AS (
      UPDATE public.plans SET
        minimum_check_notified_at = NOW(),
        host_minimum_response_deadline = NOW() + INTERVAL '24 hours'
      WHERE COALESCE(is_group_plan, false)
        AND status = 'active'
        AND minimum_check_notified_at IS NULL
        AND accepted_guest_count < minimum_member_count
        AND scheduled_at - NOW() BETWEEN INTERVAL '47 hours' AND INTERVAL '49 hours'
      RETURNING id, creator_id, accepted_guest_count, minimum_member_count
    )
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT f.creator_id,
      'group_minimum_not_met',
      'Your Group Plan needs more members',
      'Your group meetup is in 48 hours and has ' || f.accepted_guest_count || ' of ' || f.minimum_member_count || ' required members. Choose: Extend Registration, Proceed as Smaller Group, or Cancel.',
      jsonb_build_object(
        'href', '/plan/' || f.id || '/minimum-action',
        'planId', f.id::text,
        'currentCount', f.accepted_guest_count,
        'requiredCount', f.minimum_member_count
      )
    FROM flagged f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = f.creator_id
        AND n.type = 'group_minimum_not_met'
        AND (n.data->>'planId') = f.id::text
    );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-minimum-auto-cancel') THEN
    PERFORM cron.unschedule('group-minimum-auto-cancel');
  END IF;
  PERFORM cron.schedule(
    'group-minimum-auto-cancel',
    '*/15 * * * *',
    $job$
    WITH cancelled AS (
      UPDATE public.plans SET
        status = 'cancelled',
        minimum_check_outcome = 'cancelled_minimum',
        cancellation_reason_type = 'insufficient_group_size',
        cancellation_reason_text = 'Auto-cancelled: minimum membership not met and host did not respond within 24 hours.',
        updated_at = NOW()
      WHERE COALESCE(is_group_plan, false)
        AND status = 'active'
        AND accepted_guest_count < minimum_member_count
        AND host_minimum_response_deadline IS NOT NULL
        AND host_minimum_response_deadline < NOW()
        AND minimum_check_outcome IS NULL
      RETURNING id
    )
    SELECT public._refund_all_group_guests(id, true) FROM cancelled;
    $job$
  );
END;
$cron$;

NOTIFY pgrst, 'reload schema';
