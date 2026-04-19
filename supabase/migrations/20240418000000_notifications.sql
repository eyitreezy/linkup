/**
 * In-app notification inbox + server-side enqueue for trust / commerce events.
 * Push delivery: register Expo token in app → store (profile.preferences) → Edge Function / webhook sends FCM.
 * Email: trigger from same webhook; never put sensitive amounts in notification body (use generic copy).
 */
CREATE TYPE public.notification_priority AS ENUM ('high', 'medium', 'low');

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  priority public.notification_priority NOT NULL DEFAULT 'medium',
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE NOT is_read;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_idx
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Inserts only via SECURITY DEFINER (triggers, Edge Functions with service role).
-- Clients cannot forge notifications for other users.

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_priority public.notification_priority DEFAULT 'medium',
  p_dedupe_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_dedupe_key IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, priority, dedupe_key)
    VALUES (
      p_user_id,
      p_type,
      p_title,
      p_body,
      COALESCE(p_data, '{}'::jsonb),
      p_priority,
      p_dedupe_key
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      data = EXCLUDED.data,
      priority = EXCLUDED.priority,
      type = EXCLUDED.type,
      is_read = false,
      updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, data, priority, dedupe_key)
    VALUES (
      p_user_id,
      p_type,
      p_title,
      p_body,
      COALESCE(p_data, '{}'::jsonb),
      p_priority,
      NULL
    )
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB, public.notification_priority, TEXT) FROM PUBLIC;

-- Notify plan host when someone submits an offer (template for other triggers).
CREATE OR REPLACE FUNCTION public.trg_plan_offers_notify_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT creator_id, title INTO v_creator_id, v_title FROM public.plans WHERE id = NEW.plan_id;
  IF v_creator_id IS NULL OR v_creator_id = NEW.bidder_id THEN
    RETURN NEW;
  END IF;
  v_body := 'Open the plan to review or counter the offer.';
  IF v_title IS NOT NULL THEN
    v_body := 'New offer on "' || v_title || '". ' || v_body;
  ELSE
    v_body := 'New offer received for your plan. ' || v_body;
  END IF;
  PERFORM public.create_notification(
    v_creator_id,
    'offer_new',
    'New offer received',
    v_body,
    jsonb_build_object(
      'planId', NEW.plan_id::text,
      'offerId', NEW.id::text,
      'href', '/plan/' || NEW.plan_id::text
    ),
    'medium',
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_offers_notify_creator ON public.plan_offers;
CREATE TRIGGER plan_offers_notify_creator
  AFTER INSERT ON public.plan_offers
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_plan_offers_notify_creator();

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Realtime: in Supabase Dashboard → Database → Publications → `supabase_realtime`, add table `notifications`.
