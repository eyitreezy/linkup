-- Canonical message text column + optional FK to media row (spec alignment).
-- Keeps legacy `body` in sync for older clients via trigger.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES public.media(id) ON DELETE SET NULL;

UPDATE public.messages SET text = body WHERE text IS NULL AND body IS NOT NULL;

UPDATE public.messages m
SET media_id = sub.id
FROM (
  SELECT DISTINCT ON (parent_id) id, parent_id
  FROM public.media
  WHERE parent_table = 'messages'
  ORDER BY parent_id, created_at ASC
) sub
WHERE m.id = sub.parent_id AND m.media_id IS NULL;

CREATE OR REPLACE FUNCTION public.messages_sync_body_text()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.text IS NULL AND NEW.body IS NOT NULL THEN
    NEW.text := NEW.body;
  ELSIF NEW.text IS NOT NULL AND (NEW.body IS NULL OR NEW.body IS DISTINCT FROM NEW.text) THEN
    NEW.body := NEW.text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_messages_body_text ON public.messages;
CREATE TRIGGER tr_messages_body_text
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_sync_body_text();

-- Link media_id after upload (sender only, conversation participant).
CREATE POLICY messages_update_own ON public.messages FOR UPDATE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_media_id ON public.messages (media_id) WHERE media_id IS NOT NULL;
