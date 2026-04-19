-- Allow both conversation participants to read media rows attached to messages (not only created_by).

DROP POLICY IF EXISTS media_select ON public.media;

CREATE POLICY media_select ON public.media FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      parent_table = 'messages'
      AND EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = media.parent_id
          AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    )
  );
