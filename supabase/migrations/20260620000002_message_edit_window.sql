-- Enforce WhatsApp-style 15-minute edit window on message content changes (server-side).

CREATE OR REPLACE FUNCTION public.messages_enforce_edit_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Soft delete: defer to delete-for-everyone trigger.
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS tr_messages_enforce_edit_window ON public.messages;
CREATE TRIGGER tr_messages_enforce_edit_window
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_enforce_edit_window();
