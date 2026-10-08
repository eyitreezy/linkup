-- MatchMaker shared activity: secure fetch RPC, answer submit (incl. Other), notifications, RLS.

ALTER TABLE public.matchmaker_connections
  ADD COLUMN IF NOT EXISTS end_reason TEXT NULL;

CREATE TABLE IF NOT EXISTS public.matchmaker_shared_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.matchmaker_connections(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  questions JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_a_answers JSONB NULL,
  user_b_answers JSONB NULL,
  a_submitted_at TIMESTAMPTZ NULL,
  b_submitted_at TIMESTAMPTZ NULL,
  revealed_at TIMESTAMPTZ NULL,
  UNIQUE (connection_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_mm_shared_activities_connection
  ON public.matchmaker_shared_activities (connection_id, week_number);

ALTER TABLE public.matchmaker_shared_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mm_shared_activities_participant_select ON public.matchmaker_shared_activities;
DROP POLICY IF EXISTS mm_shared_activities_participant_write ON public.matchmaker_shared_activities;

-- Participants must use SECURITY DEFINER RPCs for reads that conceal partner answers pre-reveal.
REVOKE ALL ON public.matchmaker_shared_activities FROM authenticated;

CREATE OR REPLACE FUNCTION public.matchmaker_normalize_activity_answer(p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text TEXT;
BEGIN
  IF p_answers IS NULL THEN
    RAISE EXCEPTION 'Answer is required';
  END IF;
  IF jsonb_typeof(p_answers) = 'string' THEN
    v_text := trim(both from p_answers #>> '{}');
    IF v_text = '' THEN
      RAISE EXCEPTION 'Answer is required';
    END IF;
    IF length(v_text) > 500 THEN
      RAISE EXCEPTION 'Answer is too long';
    END IF;
    RETURN to_jsonb(v_text);
  END IF;
  IF jsonb_typeof(p_answers) = 'object' THEN
    IF COALESCE(p_answers->>'kind', '') = 'other' THEN
      v_text := trim(both from COALESCE(p_answers->>'text', ''));
      IF v_text = '' THEN
        RAISE EXCEPTION 'Please enter your answer';
      END IF;
      IF length(v_text) > 100 THEN
        RAISE EXCEPTION 'Answer must be 100 characters or fewer';
      END IF;
      RETURN jsonb_build_object('kind', 'other', 'text', v_text);
    END IF;
  END IF;
  RAISE EXCEPTION 'Invalid answer format';
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_shared_activity_state(
  p_connection_id UUID,
  p_week_number INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_row public.matchmaker_shared_activities%ROWTYPE;
  v_is_a BOOLEAN;
  v_my_answer JSONB;
  v_partner_answer JSONB;
  v_mine_submitted TIMESTAMPTZ;
  v_partner_submitted TIMESTAMPTZ;
  v_concealed BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_conn FROM public.matchmaker_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;
  IF v_conn.user_a_id <> v_uid AND v_conn.user_b_id <> v_uid THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  v_is_a := v_conn.user_a_id = v_uid;

  SELECT * INTO v_row
  FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'activity_id', NULL,
      'connection_id', p_connection_id,
      'week_number', p_week_number,
      'questions', jsonb_build_object(
        'text', 'What does your ideal Sunday look like?',
        'options', jsonb_build_array(
          'Quiet morning with coffee',
          'Outdoor adventure',
          'Family time at home',
          'Creative or cultural outing'
        )
      ),
      'my_answer', NULL,
      'partner_answer', NULL,
      'partner_answer_concealed', false,
      'mine_submitted_at', NULL,
      'partner_submitted_at', NULL,
      'revealed_at', NULL,
      'partner_has_shared', false
    );
  END IF;

  IF v_is_a THEN
    v_my_answer := v_row.user_a_answers;
    v_partner_answer := v_row.user_b_answers;
    v_mine_submitted := v_row.a_submitted_at;
    v_partner_submitted := v_row.b_submitted_at;
  ELSE
    v_my_answer := v_row.user_b_answers;
    v_partner_answer := v_row.user_a_answers;
    v_mine_submitted := v_row.b_submitted_at;
    v_partner_submitted := v_row.a_submitted_at;
  END IF;

  IF v_row.revealed_at IS NULL AND v_partner_submitted IS NOT NULL THEN
    v_concealed := true;
    v_partner_answer := NULL;
  ELSIF v_row.revealed_at IS NOT NULL THEN
    v_concealed := false;
  END IF;

  RETURN jsonb_build_object(
    'activity_id', v_row.id,
    'connection_id', v_row.connection_id,
    'week_number', v_row.week_number,
    'questions', v_row.questions,
    'my_answer', v_my_answer,
    'partner_answer', v_partner_answer,
    'partner_answer_concealed', v_concealed,
    'mine_submitted_at', v_mine_submitted,
    'partner_submitted_at', v_partner_submitted,
    'revealed_at', v_row.revealed_at,
    'partner_has_shared', v_partner_submitted IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_submit_activity_answer(
  p_connection_id UUID,
  p_week_number INT,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_row public.matchmaker_shared_activities%ROWTYPE;
  v_norm JSONB;
  v_is_a BOOLEAN;
  v_partner_id UUID;
  v_partner_name TEXT;
  v_now TIMESTAMPTZ := now();
  v_both BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_norm := public.matchmaker_normalize_activity_answer(p_answers);

  SELECT * INTO v_conn FROM public.matchmaker_connections WHERE id = p_connection_id;
  IF NOT FOUND OR v_conn.status <> 'active' THEN
    RAISE EXCEPTION 'Connection not available';
  END IF;
  IF v_conn.user_a_id <> v_uid AND v_conn.user_b_id <> v_uid THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  v_is_a := v_conn.user_a_id = v_uid;
  v_partner_id := CASE WHEN v_is_a THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

  SELECT display_name INTO v_partner_name FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.matchmaker_shared_activities (connection_id, week_number, questions)
  VALUES (
    p_connection_id,
    p_week_number,
    jsonb_build_object(
      'text', 'What does your ideal Sunday look like?',
      'options', jsonb_build_array(
        'Quiet morning with coffee',
        'Outdoor adventure',
        'Family time at home',
        'Creative or cultural outing'
      )
    )
  )
  ON CONFLICT (connection_id, week_number) DO NOTHING;

  SELECT * INTO v_row
  FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number
  FOR UPDATE;

  IF v_is_a THEN
    IF v_row.a_submitted_at IS NOT NULL THEN
      RAISE EXCEPTION 'You already submitted this activity';
    END IF;
    UPDATE public.matchmaker_shared_activities
    SET user_a_answers = v_norm, a_submitted_at = v_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    IF v_row.b_submitted_at IS NOT NULL THEN
      RAISE EXCEPTION 'You already submitted this activity';
    END IF;
    UPDATE public.matchmaker_shared_activities
    SET user_b_answers = v_norm, b_submitted_at = v_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  v_both := v_row.a_submitted_at IS NOT NULL AND v_row.b_submitted_at IS NOT NULL;

  IF v_both AND v_row.revealed_at IS NULL THEN
    UPDATE public.matchmaker_shared_activities SET revealed_at = v_now WHERE id = v_row.id;
    SELECT display_name INTO v_partner_name FROM public.profiles WHERE user_id = v_partner_id;
    PERFORM public.create_notification(
      v_conn.user_a_id,
      'matchmaker_activity_revealed',
      'Shared Activity',
      COALESCE((SELECT display_name FROM public.profiles WHERE user_id = v_partner_id), 'Your match')
        || ' answered. See what you both said.',
      jsonb_build_object('connection_id', p_connection_id, 'week_number', p_week_number),
      'medium',
      'mm_activity_revealed:' || p_connection_id::text || ':' || p_week_number::text || ':' || v_conn.user_a_id::text
    );
    PERFORM public.create_notification(
      v_conn.user_b_id,
      'matchmaker_activity_revealed',
      'Shared Activity',
      COALESCE((SELECT display_name FROM public.profiles WHERE user_id = v_uid), 'Your match')
        || ' answered. See what you both said.',
      jsonb_build_object('connection_id', p_connection_id, 'week_number', p_week_number),
      'medium',
      'mm_activity_revealed:' || p_connection_id::text || ':' || p_week_number::text || ':' || v_conn.user_b_id::text
    );
  ELSE
    PERFORM public.create_notification(
      v_partner_id,
      'matchmaker_activity_shared',
      'Shared Activity',
      COALESCE(v_partner_name, 'Your match') || ' shared an activity answer. Add yours to reveal both.',
      jsonb_build_object('connection_id', p_connection_id, 'week_number', p_week_number),
      'medium',
      'mm_activity_shared:' || p_connection_id::text || ':' || p_week_number::text || ':' || v_partner_id::text
    );
  END IF;

  RETURN public.matchmaker_get_shared_activity_state(p_connection_id, p_week_number);
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_get_shared_activity_state(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_shared_activity_state(UUID, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.matchmaker_submit_activity_answer(UUID, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_submit_activity_answer(UUID, INT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.matchmaker_normalize_activity_answer(JSONB) FROM PUBLIC;
