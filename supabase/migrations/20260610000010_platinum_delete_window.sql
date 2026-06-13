-- Platinum: extended delete-for-everyone window + per-message receipt_hidden.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receipt_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.messages_enforce_delete_everyone_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  _sender_tier text;
  _window interval;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF OLD.sender_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'message_delete_everyone_not_sender'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT subscription_tier INTO _sender_tier
    FROM public.users
    WHERE id = OLD.sender_id;

    _window := CASE COALESCE(_sender_tier, 'FREE')
      WHEN 'PLATINUM' THEN interval '1 hour'
      ELSE interval '15 minutes'
    END;

    IF (now() - OLD.created_at) > _window THEN
      RAISE EXCEPTION 'message_delete_everyone_window_expired'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
