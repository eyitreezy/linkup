-- Per-user "delete for me" + server-side delete-for-everyone time window.

CREATE TABLE IF NOT EXISTS public.message_user_deletions (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_user_deletions_conv
  ON public.message_user_deletions (user_id, conversation_id, deleted_at DESC);

ALTER TABLE public.message_user_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_user_deletions_own ON public.message_user_deletions;
CREATE POLICY message_user_deletions_own ON public.message_user_deletions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
        AND m.conversation_id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- Delete-for-everyone: own messages within 15 minutes (WhatsApp-style recall window).
CREATE OR REPLACE FUNCTION public.messages_enforce_delete_everyone_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF OLD.sender_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'message_delete_everyone_not_sender'
        USING ERRCODE = 'check_violation';
    END IF;
    IF (now() - OLD.created_at) > interval '15 minutes' THEN
      RAISE EXCEPTION 'message_delete_everyone_window_expired'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_messages_enforce_delete_everyone_window ON public.messages;
CREATE TRIGGER tr_messages_enforce_delete_everyone_window
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_enforce_delete_everyone_window();

-- Edit-window trigger: ignore soft-delete updates (handled above).
CREATE OR REPLACE FUNCTION public.messages_enforce_edit_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;

  IF NEW.text IS NOT DISTINCT FROM OLD.text
     AND NEW.body IS NOT DISTINCT FROM OLD.body
     AND NEW.edited_at IS NOT DISTINCT FROM OLD.edited_at THEN
    RETURN NEW;
  END IF;

  IF NEW.text IS DISTINCT FROM OLD.text OR NEW.body IS DISTINCT FROM OLD.body THEN
    IF (now() - OLD.created_at) > interval '15 minutes' THEN
      RAISE EXCEPTION 'message_edit_window_expired'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
