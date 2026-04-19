-- Real-time presence: online / last seen / typing pointer (privacy enforced in app from profile.visibility).

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  typing_conversation_id uuid REFERENCES public.conversations (id) ON DELETE SET NULL,
  typing_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_typing_conv ON public.user_presence (typing_conversation_id)
  WHERE typing_conversation_id IS NOT NULL;

CREATE TRIGGER tr_user_presence_updated
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Read: self, chat partner, or plan/offer counterparty (feed cards with bids, agreements).
CREATE POLICY user_presence_select ON public.user_presence
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE (c.user_a = auth.uid() AND c.user_b = user_presence.user_id)
         OR (c.user_b = auth.uid() AND c.user_a = user_presence.user_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.plans p
      JOIN public.plan_offers o ON o.plan_id = p.id AND o.bidder_id = auth.uid()
      WHERE p.creator_id = user_presence.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.plans p
      JOIN public.plan_offers o ON o.plan_id = p.id AND o.bidder_id = user_presence.user_id
      WHERE p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.plans p
      JOIN public.plan_offers o ON o.id = p.accepted_offer_id
      WHERE p.accepted_offer_id IS NOT NULL
        AND (
          (p.creator_id = auth.uid() AND o.bidder_id = user_presence.user_id)
          OR (p.creator_id = user_presence.user_id AND o.bidder_id = auth.uid())
        )
    )
  );

CREATE POLICY user_presence_insert ON public.user_presence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_presence_update ON public.user_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;
