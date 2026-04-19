-- Allow senders to remove their own messages (e.g. rollback failed media upload).

CREATE POLICY messages_delete_own ON public.messages FOR DELETE
  USING (sender_id = auth.uid());
