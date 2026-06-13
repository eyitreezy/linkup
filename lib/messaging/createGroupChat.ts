import { supabase } from '@/lib/supabase';

export type CreateGroupChatParams = {
  planId: string;
  hostId: string;
  groupName?: string;
  initialMemberIds: string[];
};

export async function createGroupChat({
  planId,
  hostId,
  groupName,
  initialMemberIds,
}: CreateGroupChatParams): Promise<string> {
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('is_group_plan, creator_id, title')
    .eq('id', planId)
    .single();

  if (planErr || !plan?.is_group_plan || plan.creator_id !== hostId) {
    throw new Error('Only group plan hosts can create group chats');
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('plan_id', planId)
    .eq('is_group_chat', true)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      is_group_chat: true,
      plan_id: planId,
      group_name: groupName ?? plan.title,
      created_by: hostId,
    })
    .select('id')
    .single();

  if (convErr || !conv?.id) {
    throw new Error(convErr?.message ?? 'Could not create group chat');
  }

  const conversationId = conv.id;

  const { error: hostErr } = await supabase.from('group_chat_members').insert({
    conversation_id: conversationId,
    user_id: hostId,
    is_admin: true,
  });
  if (hostErr) throw new Error(hostErr.message);

  const guestIds = [...new Set(initialMemberIds.filter((id) => id !== hostId))];
  if (guestIds.length > 0) {
    const { error: guestsErr } = await supabase.from('group_chat_members').insert(
      guestIds.map((uid) => ({
        conversation_id: conversationId,
        user_id: uid,
        is_admin: false,
      }))
    );
    if (guestsErr) throw new Error(guestsErr.message);
  }

  return conversationId;
}
