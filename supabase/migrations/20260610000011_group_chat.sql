-- Group chat threads tied to group plans.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_group_chat boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans (id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_name text;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_avatar_url text;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users (id);

ALTER TABLE public.conversations
  ALTER COLUMN user_a DROP NOT NULL;

ALTER TABLE public.conversations
  ALTER COLUMN user_b DROP NOT NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_ordered;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_group_or_pair CHECK (
    (
      is_group_chat = true
      AND user_a IS NULL
      AND user_b IS NULL
      AND plan_id IS NOT NULL
    )
    OR (
      is_group_chat = false
      AND user_a IS NOT NULL
      AND user_b IS NOT NULL
      AND user_a::text < user_b::text
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_group_plan
  ON public.conversations (plan_id)
  WHERE is_group_chat = true AND plan_id IS NOT NULL;

ALTER TABLE public.messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS group_sender_display text;

CREATE TABLE IF NOT EXISTS public.group_chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users (id),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_members_conv
  ON public.group_chat_members (conversation_id, removed_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_group_chat_members_user
  ON public.group_chat_members (user_id, removed_at NULLS FIRST);

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_members_select ON public.group_chat_members;
CREATE POLICY group_members_select ON public.group_chat_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.conversation_id = group_chat_members.conversation_id
        AND gcm.user_id = auth.uid()
        AND gcm.removed_at IS NULL
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS group_members_insert ON public.group_chat_members;
CREATE POLICY group_members_insert ON public.group_chat_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = group_chat_members.conversation_id
        AND c.is_group_chat = true
        AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.conversation_id = group_chat_members.conversation_id
        AND gcm.user_id = auth.uid()
        AND gcm.is_admin = true
        AND gcm.removed_at IS NULL
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS group_members_update ON public.group_chat_members;
CREATE POLICY group_members_update ON public.group_chat_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.conversation_id = group_chat_members.conversation_id
        AND gcm.user_id = auth.uid()
        AND gcm.is_admin = true
        AND gcm.removed_at IS NULL
    )
    OR user_id = auth.uid()
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (true);

-- Extend conversations RLS for group members.
DROP POLICY IF EXISTS conv_select ON public.conversations;
CREATE POLICY conv_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.conversation_id = conversations.id
        AND gcm.user_id = auth.uid()
        AND gcm.removed_at IS NULL
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS conv_insert ON public.conversations;
CREATE POLICY conv_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      is_group_chat = false
      AND (user_a = auth.uid() OR user_b = auth.uid())
    )
    OR (
      is_group_chat = true
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.plans p
        WHERE p.id = conversations.plan_id
          AND p.creator_id = auth.uid()
          AND p.is_group_plan = true
      )
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS conv_update ON public.conversations;
CREATE POLICY conv_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.conversation_id = conversations.id
        AND gcm.user_id = auth.uid()
        AND gcm.removed_at IS NULL
    )
  )
  WITH CHECK (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.conversation_id = conversations.id
        AND gcm.user_id = auth.uid()
        AND gcm.removed_at IS NULL
    )
  );

-- Messages: group members can read/send; system messages have null sender_id.
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.user_a = auth.uid()
          OR c.user_b = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.group_chat_members gcm
            WHERE gcm.conversation_id = c.id
              AND gcm.user_id = auth.uid()
              AND gcm.removed_at IS NULL
          )
        )
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      sender_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (
            (NOT c.is_group_chat AND (c.user_a = auth.uid() OR c.user_b = auth.uid()))
            OR (
              c.is_group_chat
              AND EXISTS (
                SELECT 1 FROM public.group_chat_members gcm
                WHERE gcm.conversation_id = c.id
                  AND gcm.user_id = auth.uid()
                  AND gcm.removed_at IS NULL
              )
            )
          )
      )
    )
    OR (
      sender_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        INNER JOIN public.group_chat_members gcm ON gcm.conversation_id = c.id
        WHERE c.id = messages.conversation_id
          AND c.is_group_chat = true
          AND gcm.user_id = auth.uid()
          AND gcm.removed_at IS NULL
      )
    )
    OR public.is_admin(auth.uid())
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_members;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;
