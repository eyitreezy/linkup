-- Chat: forward metadata, per-conversation pinned message, conversation UPDATE for participants.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_forwarded boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from ON public.messages (forwarded_from_message_id)
  WHERE forwarded_from_message_id IS NOT NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_pinned_message ON public.conversations (pinned_message_id)
  WHERE pinned_message_id IS NOT NULL;

DROP POLICY IF EXISTS conv_update ON public.conversations;

CREATE POLICY conv_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

-- Realtime pin updates for both participants
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;
