-- Chat: realtime delivery, server read receipts, reply-to-message.

-- Reply threading
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- Per-user read cursor (powers ✓✓ + inbox unread)
CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  last_read_message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user ON public.conversation_reads (user_id);

CREATE TRIGGER tr_conversation_reads_updated
  BEFORE UPDATE ON public.conversation_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_reads_select ON public.conversation_reads
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_reads.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

CREATE POLICY conversation_reads_insert ON public.conversation_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_reads.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

CREATE POLICY conversation_reads_update ON public.conversation_reads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Upsert read cursor when viewer opens a thread
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL
)
RETURNS public.conversation_reads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_read_at timestamptz;
  v_msg_id uuid;
  r public.conversation_reads;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (c.user_a = v_uid OR c.user_b = v_uid)
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF p_message_id IS NOT NULL THEN
    SELECT m.created_at, m.id
    INTO v_read_at, v_msg_id
    FROM public.messages m
    WHERE m.id = p_message_id
      AND m.conversation_id = p_conversation_id;
  END IF;

  IF v_read_at IS NULL THEN
    SELECT m.created_at, m.id
    INTO v_read_at, v_msg_id
    FROM public.messages m
    WHERE m.conversation_id = p_conversation_id
    ORDER BY m.created_at DESC
    LIMIT 1;
  END IF;

  IF v_read_at IS NULL THEN
    v_read_at := now();
    v_msg_id := NULL;
  END IF;

  INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at, last_read_message_id)
  VALUES (p_conversation_id, v_uid, v_read_at, v_msg_id)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
  SET
    last_read_at = GREATEST(conversation_reads.last_read_at, EXCLUDED.last_read_at),
    last_read_message_id = CASE
      WHEN EXCLUDED.last_read_at >= conversation_reads.last_read_at THEN EXCLUDED.last_read_message_id
      ELSE conversation_reads.last_read_message_id
    END,
    updated_at = now();

  SELECT * INTO r
  FROM public.conversation_reads
  WHERE conversation_id = p_conversation_id
    AND user_id = v_uid;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid, uuid) TO authenticated;

-- Realtime CDC for instant delivery + read receipt updates
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_reads;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;
