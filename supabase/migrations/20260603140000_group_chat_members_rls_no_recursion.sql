/**
 * Fix "infinite recursion detected in policy for relation group_chat_members".
 *
 * group_members_select (and related policies) queried group_chat_members inside
 * their own RLS predicates. Use SECURITY DEFINER helpers with row_security off,
 * matching the plans/offers recursion fix pattern.
 */

CREATE OR REPLACE FUNCTION public.auth_uid_is_active_group_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ok boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.group_chat_members gcm
    WHERE gcm.conversation_id = p_conversation_id
      AND gcm.user_id = auth.uid()
      AND gcm.removed_at IS NULL
  ) INTO ok;

  RETURN COALESCE(ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_uid_is_group_admin(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ok boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.group_chat_members gcm
    WHERE gcm.conversation_id = p_conversation_id
      AND gcm.user_id = auth.uid()
      AND gcm.is_admin = true
      AND gcm.removed_at IS NULL
  ) INTO ok;

  RETURN COALESCE(ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_uid_is_active_group_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_uid_is_group_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_is_active_group_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_uid_is_group_admin(uuid) TO authenticated, service_role;

-- group_chat_members
DROP POLICY IF EXISTS group_members_select ON public.group_chat_members;
CREATE POLICY group_members_select ON public.group_chat_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.auth_uid_is_active_group_member(conversation_id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS group_members_insert ON public.group_chat_members;
CREATE POLICY group_members_insert ON public.group_chat_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = group_chat_members.conversation_id
        AND c.is_group_chat = true
        AND c.created_by = auth.uid()
    )
    OR public.auth_uid_is_group_admin(group_chat_members.conversation_id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS group_members_update ON public.group_chat_members;
CREATE POLICY group_members_update ON public.group_chat_members
  FOR UPDATE TO authenticated
  USING (
    public.auth_uid_is_group_admin(conversation_id)
    OR user_id = auth.uid()
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (true);

-- conversations (group member access)
DROP POLICY IF EXISTS conv_select ON public.conversations;
CREATE POLICY conv_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR public.auth_uid_is_active_group_member(id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS conv_update ON public.conversations;
CREATE POLICY conv_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR public.auth_uid_is_active_group_member(id)
  )
  WITH CHECK (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR public.auth_uid_is_active_group_member(id)
  );

-- messages (group member read/send)
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.user_a = auth.uid()
          OR c.user_b = auth.uid()
          OR public.auth_uid_is_active_group_member(c.id)
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
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (
            (NOT c.is_group_chat AND (c.user_a = auth.uid() OR c.user_b = auth.uid()))
            OR (c.is_group_chat AND public.auth_uid_is_active_group_member(c.id))
          )
      )
    )
    OR (
      sender_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.is_group_chat = true
          AND public.auth_uid_is_active_group_member(c.id)
      )
    )
    OR public.is_admin(auth.uid())
  );
