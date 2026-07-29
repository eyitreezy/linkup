-- Ratings and reviews system: bilateral blind reviews, profile aggregates, moderation queue.

-- 1. Rating columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS host_rating_score        NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS host_rating_count        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_score_punctuality   NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS host_score_conduct       NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS host_score_plan_quality  NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS guest_rating_score       NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS guest_rating_count       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_score_punctuality  NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS guest_score_conduct      NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS completed_meetup_count   INT NOT NULL DEFAULT 0;

-- 2. Reviews table
CREATE TABLE IF NOT EXISTS public.meetup_reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id            UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  reviewer_id        UUID NOT NULL REFERENCES public.users(id),
  reviewee_id        UUID NOT NULL REFERENCES public.users(id),
  reviewer_role      TEXT NOT NULL CHECK (reviewer_role IN ('host', 'guest')),
  score_punctuality  SMALLINT NOT NULL CHECK (score_punctuality BETWEEN 0 AND 5),
  score_conduct      SMALLINT NOT NULL CHECK (score_conduct BETWEEN 0 AND 5),
  score_plan_quality SMALLINT CHECK (score_plan_quality BETWEEN 1 AND 5),
  review_text        TEXT,
  is_hidden          BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revealed_at        TIMESTAMPTZ,
  unlock_at          TIMESTAMPTZ,
  edit_locked_at     TIMESTAMPTZ,
  is_suppressed      BOOLEAN NOT NULL DEFAULT FALSE,
  suppressed_by      UUID REFERENCES public.users(id),
  suppressed_at      TIMESTAMPTZ,
  suppression_reason TEXT,
  UNIQUE(plan_id, reviewer_id)
);

ALTER TABLE public.meetup_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviewer_read_own ON public.meetup_reviews;
CREATE POLICY reviewer_read_own
  ON public.meetup_reviews FOR SELECT
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS reviewee_read_revealed ON public.meetup_reviews;
CREATE POLICY reviewee_read_revealed
  ON public.meetup_reviews FOR SELECT
  USING (
    reviewee_id = auth.uid()
    AND is_hidden = FALSE
    AND is_suppressed = FALSE
  );

DROP POLICY IF EXISTS public_read_revealed_host_reviews ON public.meetup_reviews;
CREATE POLICY public_read_revealed_host_reviews
  ON public.meetup_reviews FOR SELECT
  USING (
    is_hidden = FALSE
    AND is_suppressed = FALSE
    AND reviewer_role = 'guest'
  );

DROP POLICY IF EXISTS reviewer_insert ON public.meetup_reviews;
CREATE POLICY reviewer_insert
  ON public.meetup_reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS reviewer_update_within_window ON public.meetup_reviews;
CREATE POLICY reviewer_update_within_window
  ON public.meetup_reviews FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    AND (edit_locked_at IS NULL OR edit_locked_at > NOW())
  );

DROP POLICY IF EXISTS admin_manage_reviews ON public.meetup_reviews;
CREATE POLICY admin_manage_reviews
  ON public.meetup_reviews FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reviews_plan ON public.meetup_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.meetup_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_hidden ON public.meetup_reviews(is_hidden)
  WHERE is_hidden = TRUE;

-- 3. Review reports
CREATE TABLE IF NOT EXISTS public.review_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES public.meetup_reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id),
  reason      TEXT NOT NULL CHECK (reason IN (
    'inaccurate', 'abusive', 'retaliatory', 'spam', 'other'
  )),
  reason_text TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'suppressed', 'dismissed')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(review_id, reporter_id)
);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_insert_own_report ON public.review_reports;
CREATE POLICY users_insert_own_report
  ON public.review_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS users_read_own_report ON public.review_reports;
CREATE POLICY users_read_own_report
  ON public.review_reports FOR SELECT
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS admin_manage_reports ON public.review_reports;
CREATE POLICY admin_manage_reports
  ON public.review_reports FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status, reported_at);

-- 4. Plan review tracking
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS review_unlock_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_reveal_at TIMESTAMPTZ;

-- 5. unlock_plan_reviews
CREATE OR REPLACE FUNCTION public.unlock_plan_reviews(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _open_dispute_count INT;
  _cooldown_count INT;
  _unlock_at TIMESTAMPTZ := NOW();
  _reveal_at TIMESTAMPTZ := NOW() + INTERVAL '7 days';
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  SELECT COUNT(*) INTO _open_dispute_count
  FROM public.disputes
  WHERE plan_id = p_plan_id
    AND status IN ('pending', 'reviewing');

  IF _open_dispute_count > 0 THEN
    RETURN jsonb_build_object(
      'unlocked', false,
      'reason', 'open_dispute',
      'dispute_count', _open_dispute_count
    );
  END IF;

  SELECT COUNT(*) INTO _cooldown_count
  FROM public.disputes
  WHERE plan_id = p_plan_id
    AND status IN ('resolved', 'rejected')
    AND COALESCE(resolved_at, updated_at) > NOW() - INTERVAL '48 hours';

  IF _cooldown_count > 0 THEN
    RETURN jsonb_build_object(
      'unlocked', false,
      'reason', 'dispute_cooldown',
      'cooldown_count', _cooldown_count
    );
  END IF;

  IF _plan.review_unlock_at IS NOT NULL THEN
    RETURN jsonb_build_object('unlocked', true, 'already_unlocked', true);
  END IF;

  UPDATE public.plans SET
    review_unlock_at = _unlock_at,
    review_reveal_at = _reveal_at,
    updated_at = NOW()
  WHERE id = p_plan_id;

  INSERT INTO public.meetup_reviews (
    plan_id, reviewer_id, reviewee_id, reviewer_role,
    score_punctuality, score_conduct, is_hidden, unlock_at
  )
  SELECT
    p_plan_id,
    p.creator_id,
    po.bidder_id,
    'host',
    0, 0, TRUE, _reveal_at
  FROM public.plans p
  JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'
  WHERE p.id = p_plan_id
  ON CONFLICT (plan_id, reviewer_id) DO NOTHING;

  INSERT INTO public.meetup_reviews (
    plan_id, reviewer_id, reviewee_id, reviewer_role,
    score_punctuality, score_conduct, is_hidden, unlock_at
  )
  SELECT
    p_plan_id,
    po.bidder_id,
    p.creator_id,
    'guest',
    0, 0, TRUE, _reveal_at
  FROM public.plans p
  JOIN public.plan_offers po ON po.plan_id = p.id AND po.status = 'accepted'
  WHERE p.id = p_plan_id
  ON CONFLICT (plan_id, reviewer_id) DO NOTHING;

  RETURN jsonb_build_object(
    'unlocked', true,
    'unlock_at', _unlock_at,
    'reveal_at', _reveal_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_plan_reviews(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_plan_reviews(UUID) TO authenticated, service_role, postgres;

-- 6. submit_review
CREATE OR REPLACE FUNCTION public.submit_review(
  p_plan_id            UUID,
  p_score_punctuality  SMALLINT,
  p_score_conduct      SMALLINT,
  p_score_plan_quality SMALLINT DEFAULT NULL,
  p_review_text        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   UUID := auth.uid();
  _review    public.meetup_reviews%ROWTYPE;
  _plan      public.plans%ROWTYPE;
  _edit_lock TIMESTAMPTZ;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  IF _plan.review_unlock_at IS NULL THEN
    RAISE EXCEPTION 'reviews_not_unlocked';
  END IF;

  SELECT * INTO _review
  FROM public.meetup_reviews
  WHERE plan_id = p_plan_id AND reviewer_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  IF _review.score_punctuality > 0 THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  IF _review.reviewer_role = 'host' AND p_score_plan_quality IS NOT NULL THEN
    RAISE EXCEPTION 'hosts_cannot_rate_plan_quality';
  END IF;

  IF _review.reviewer_role = 'guest'
     AND (p_score_plan_quality IS NULL OR p_score_plan_quality < 1) THEN
    RAISE EXCEPTION 'plan_quality_required';
  END IF;

  _edit_lock := LEAST(
    NOW() + INTERVAL '24 hours',
    COALESCE(_plan.review_reveal_at, NOW() + INTERVAL '7 days')
  );

  UPDATE public.meetup_reviews SET
    score_punctuality  = p_score_punctuality,
    score_conduct      = p_score_conduct,
    score_plan_quality = p_score_plan_quality,
    review_text        = p_review_text,
    submitted_at       = NOW(),
    edit_locked_at     = _edit_lock
  WHERE plan_id = p_plan_id AND reviewer_id = _user_id;

  PERFORM public.check_and_reveal_reviews(p_plan_id);
  PERFORM public.recompute_profile_ratings(_review.reviewee_id);

  RETURN jsonb_build_object('submitted', true, 'edit_locked_at', _edit_lock);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review(UUID, SMALLINT, SMALLINT, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, SMALLINT, SMALLINT, SMALLINT, TEXT) TO authenticated;

-- 7. check_and_reveal_reviews
CREATE OR REPLACE FUNCTION public.check_and_reveal_reviews(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_count     INT;
  _submitted_count INT;
  _now             TIMESTAMPTZ := NOW();
  _reviewee_id     UUID;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE score_punctuality > 0),
    COUNT(*)
  INTO _submitted_count, _total_count
  FROM public.meetup_reviews
  WHERE plan_id = p_plan_id AND is_hidden = TRUE;

  IF _submitted_count >= _total_count AND _total_count > 0 AND _submitted_count > 0 THEN
    UPDATE public.meetup_reviews SET
      is_hidden      = FALSE,
      revealed_at    = _now,
      edit_locked_at = _now
    WHERE plan_id = p_plan_id
      AND is_hidden = TRUE
      AND score_punctuality > 0;

    UPDATE public.plans SET review_reveal_at = _now WHERE id = p_plan_id;

    FOR _reviewee_id IN
      SELECT DISTINCT reviewee_id FROM public.meetup_reviews WHERE plan_id = p_plan_id
    LOOP
      PERFORM public.recompute_profile_ratings(_reviewee_id);
    END LOOP;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_reveal_reviews(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_reveal_reviews(UUID) TO authenticated, service_role, postgres;

-- 8. reveal_plan_reviews (T+7 cron)
CREATE OR REPLACE FUNCTION public.reveal_plan_reviews()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _revealed INT := 0;
  _plan_id  UUID;
  _reviewee_id UUID;
BEGIN
  FOR _plan_id IN
    SELECT DISTINCT mr.plan_id
    FROM public.meetup_reviews mr
    JOIN public.plans p ON p.id = mr.plan_id
    WHERE mr.is_hidden = TRUE
      AND mr.score_punctuality > 0
      AND (
        p.review_reveal_at <= NOW()
        OR mr.unlock_at <= NOW()
      )
  LOOP
    UPDATE public.meetup_reviews SET
      is_hidden      = FALSE,
      revealed_at    = NOW(),
      edit_locked_at = NOW()
    WHERE plan_id = _plan_id
      AND is_hidden = TRUE
      AND score_punctuality > 0;

    UPDATE public.plans
    SET review_reveal_at = LEAST(COALESCE(review_reveal_at, NOW()), NOW())
    WHERE id = _plan_id;

    FOR _reviewee_id IN
      SELECT DISTINCT reviewee_id FROM public.meetup_reviews WHERE plan_id = _plan_id
    LOOP
      PERFORM public.recompute_profile_ratings(_reviewee_id);
    END LOOP;

    _revealed := _revealed + 1;
  END LOOP;

  RETURN _revealed;
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_plan_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_plan_reviews() TO service_role, postgres;

-- 9. recompute_profile_ratings
CREATE OR REPLACE FUNCTION public.recompute_profile_ratings(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host_stats  RECORD;
  _guest_stats RECORD;
  _meetup_count INT;
BEGIN
  SELECT
    COUNT(*) AS cnt,
    AVG(score_punctuality) AS avg_punctuality,
    AVG(score_conduct) AS avg_conduct,
    AVG(score_plan_quality) AS avg_plan_quality,
    AVG(
      COALESCE(score_plan_quality, score_conduct) * 0.40 +
      score_conduct * 0.35 +
      score_punctuality * 0.25
    ) AS overall
  INTO _host_stats
  FROM public.meetup_reviews
  WHERE reviewee_id = p_user_id
    AND reviewer_role = 'guest'
    AND is_hidden = FALSE
    AND is_suppressed = FALSE
    AND score_punctuality > 0;

  SELECT
    COUNT(*) AS cnt,
    AVG(score_punctuality) AS avg_punctuality,
    AVG(score_conduct) AS avg_conduct,
    AVG(
      score_conduct * 0.60 +
      score_punctuality * 0.40
    ) AS overall
  INTO _guest_stats
  FROM public.meetup_reviews
  WHERE reviewee_id = p_user_id
    AND reviewer_role = 'host'
    AND is_hidden = FALSE
    AND is_suppressed = FALSE
    AND score_punctuality > 0;

  SELECT COUNT(DISTINCT p.id) INTO _meetup_count
  FROM public.plans p
  LEFT JOIN public.plan_offers po ON po.plan_id = p.id AND po.bidder_id = p_user_id AND po.status = 'accepted'
  WHERE (
    (p.completion_status = 'confirmed')
    OR (p.status = 'completed' AND NOT COALESCE(p.is_group_plan, false))
  )
  AND (p.creator_id = p_user_id OR po.id IS NOT NULL);

  UPDATE public.profiles SET
    host_rating_score       = CASE WHEN COALESCE(_host_stats.cnt, 0) > 0 THEN ROUND(_host_stats.overall::NUMERIC, 2) ELSE NULL END,
    host_rating_count       = COALESCE(_host_stats.cnt, 0),
    host_score_punctuality  = CASE WHEN COALESCE(_host_stats.cnt, 0) > 0 THEN ROUND(_host_stats.avg_punctuality::NUMERIC, 2) ELSE NULL END,
    host_score_conduct      = CASE WHEN COALESCE(_host_stats.cnt, 0) > 0 THEN ROUND(_host_stats.avg_conduct::NUMERIC, 2) ELSE NULL END,
    host_score_plan_quality = CASE WHEN COALESCE(_host_stats.cnt, 0) > 0 THEN ROUND(_host_stats.avg_plan_quality::NUMERIC, 2) ELSE NULL END,
    guest_rating_score      = CASE WHEN COALESCE(_guest_stats.cnt, 0) > 0 THEN ROUND(_guest_stats.overall::NUMERIC, 2) ELSE NULL END,
    guest_rating_count      = COALESCE(_guest_stats.cnt, 0),
    guest_score_punctuality = CASE WHEN COALESCE(_guest_stats.cnt, 0) > 0 THEN ROUND(_guest_stats.avg_punctuality::NUMERIC, 2) ELSE NULL END,
    guest_score_conduct     = CASE WHEN COALESCE(_guest_stats.cnt, 0) > 0 THEN ROUND(_guest_stats.avg_conduct::NUMERIC, 2) ELSE NULL END,
    completed_meetup_count  = COALESCE(_meetup_count, 0)
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_profile_ratings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_profile_ratings(UUID) TO authenticated, service_role, postgres;

-- 10. Triggers: unlock reviews after bilateral ack or group confirmation
CREATE OR REPLACE FUNCTION public.trg_try_unlock_reviews_after_ack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.plan_completion_acks
  WHERE plan_id = NEW.plan_id;

  IF v_count >= 2 THEN
    PERFORM public.unlock_plan_reviews(NEW.plan_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_completion_acks_unlock_reviews ON public.plan_completion_acks;
CREATE TRIGGER trg_plan_completion_acks_unlock_reviews
AFTER INSERT ON public.plan_completion_acks
FOR EACH ROW EXECUTE FUNCTION public.trg_try_unlock_reviews_after_ack();

CREATE OR REPLACE FUNCTION public.trg_unlock_reviews_on_plan_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completion_status = 'confirmed'
     AND (OLD.completion_status IS DISTINCT FROM 'confirmed') THEN
    PERFORM public.unlock_plan_reviews(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plans_unlock_reviews_confirmed ON public.plans;
CREATE TRIGGER trg_plans_unlock_reviews_confirmed
AFTER UPDATE OF completion_status ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.trg_unlock_reviews_on_plan_confirmed();

-- Retry unlock after dispute cooldown (hourly)
CREATE OR REPLACE FUNCTION public.retry_unlock_plan_reviews_after_cooldown()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id UUID;
  _unlocked INT := 0;
  _result JSONB;
BEGIN
  FOR _plan_id IN
    SELECT p.id
    FROM public.plans p
    WHERE p.review_unlock_at IS NULL
      AND (
        p.completion_status = 'confirmed'
        OR (
          p.status = 'completed'
          AND (SELECT COUNT(*) FROM public.plan_completion_acks a WHERE a.plan_id = p.id) >= 2
        )
      )
  LOOP
    _result := public.unlock_plan_reviews(_plan_id);
    IF (_result->>'unlocked')::boolean THEN
      _unlocked := _unlocked + 1;
    END IF;
  END LOOP;
  RETURN _unlocked;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_unlock_plan_reviews_after_cooldown() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_unlock_plan_reviews_after_cooldown() TO service_role, postgres;

-- Patch auto-confirm sweep to unlock reviews
CREATE OR REPLACE FUNCTION public.sweep_auto_confirm_meetups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_escrow RECORD;
  v_confirmed_count INT := 0;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
  v_guest_id UUID;
BEGIN
  FOR v_plan IN
    SELECT p.id, p.creator_id, p.accepted_offer_id,
           p.agreed_scheduled_at, p.scheduled_at
    FROM public.plans p
    WHERE p.status = 'active'
      AND COALESCE(p.agreed_scheduled_at, p.scheduled_at) < v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.escrow_disputes d
        JOIN public.escrow_transactions e ON e.id = d.escrow_id
        WHERE e.plan_id = p.id
          AND d.status IN ('open', 'under_review')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.disputes d
        WHERE d.plan_id = p.id
          AND d.status IN ('pending', 'reviewing')
      )
  LOOP
    BEGIN
      UPDATE public.plans
      SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
      WHERE id = v_plan.id
        AND status = 'active';

      FOR v_escrow IN
        SELECT id FROM public.escrow_transactions
        WHERE plan_id = v_plan.id
          AND status IN ('funded', 'active')
      LOOP
        BEGIN
          PERFORM public._escrow_release_internal(v_escrow.id, true);
          PERFORM public._queue_escrow_release_disbursement(v_escrow.id);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[auto_confirm] escrow release failed for %: %', v_escrow.id, SQLERRM;
        END;
      END LOOP;

      PERFORM public.create_notification(
        v_plan.creator_id,
        'meetup_auto_confirmed',
        'Meetup confirmed',
        'Your meetup has been automatically confirmed. Your funds are ready to withdraw.',
        jsonb_build_object('href', '/wallet', 'planId', v_plan.id::text),
        'high',
        'auto_confirm:' || v_plan.id::text || ':host'
      );

      SELECT bidder_id INTO v_guest_id FROM public.plan_offers WHERE id = v_plan.accepted_offer_id;
      IF v_guest_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_guest_id,
          'meetup_auto_confirmed',
          'Meetup confirmed',
          'Your meetup has been automatically confirmed. Your funds are ready to withdraw.',
          jsonb_build_object('href', '/wallet', 'planId', v_plan.id::text),
          'high',
          'auto_confirm:' || v_plan.id::text || ':guest'
        );
      END IF;

      PERFORM public.unlock_plan_reviews(v_plan.id);

      v_confirmed_count := v_confirmed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_confirm] plan % failed: %', v_plan.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('auto_confirmed', v_confirmed_count);
END;
$$;

-- Realtime
DO $realtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meetup_reviews'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meetup_reviews;
    END IF;
  END IF;
END;
$realtime$;

-- pg_cron jobs
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'review-reveal-t7') THEN
    PERFORM cron.unschedule('review-reveal-t7');
  END IF;
  PERFORM cron.schedule(
    'review-reveal-t7',
    '0 * * * *',
    $$SELECT public.reveal_plan_reviews()$$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'review-nudge-1h') THEN
    PERFORM cron.unschedule('review-nudge-1h');
  END IF;
  PERFORM cron.schedule(
    'review-nudge-1h',
    '*/10 * * * *',
    $job$
    SELECT public.create_notification(
      mr.reviewer_id,
      'review_request',
      'How was your meetup?',
      'Leave a review. Your feedback helps the community.',
      jsonb_build_object(
        'href', '/plan/' || mr.plan_id || '/review',
        'planId', mr.plan_id::text
      ),
      'medium',
      'review_request:' || mr.plan_id::text || ':' || mr.reviewer_id::text
    )
    FROM public.meetup_reviews mr
    JOIN public.plans p ON p.id = mr.plan_id
    WHERE mr.score_punctuality = 0
      AND mr.is_hidden = TRUE
      AND p.review_unlock_at IS NOT NULL
      AND p.review_unlock_at + INTERVAL '1 hour' < NOW()
      AND p.review_unlock_at + INTERVAL '2 hours' > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = mr.reviewer_id
          AND n.type = 'review_request'
          AND (n.data->>'planId') = mr.plan_id::text
      );
    $job$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'review-unlock-retry') THEN
    PERFORM cron.unschedule('review-unlock-retry');
  END IF;
  PERFORM cron.schedule(
    'review-unlock-retry',
    '0 * * * *',
    $$SELECT public.retry_unlock_plan_reviews_after_cooldown()$$
  );
END;
$cron$;
