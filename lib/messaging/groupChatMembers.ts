import { sendSystemMessage } from '@/lib/messaging/sendSystemMessage';
import { supabase } from '@/lib/supabase';

export type GroupChatMemberRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  is_admin: boolean;
  joined_at: string;
  removed_at: string | null;
  removed_by: string | null;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    subscription_tier: string;
  } | null;
};

export async function fetchActiveGroupMembers(
  conversationId: string
): Promise<GroupChatMemberRow[]> {
  const { data: members, error } = await supabase
    .from('group_chat_members')
    .select('id, conversation_id, user_id, is_admin, joined_at, removed_at, removed_by')
    .eq('conversation_id', conversationId)
    .is('removed_at', null);

  if (error || !members?.length) return [];

  const userIds = members.map((m) => m.user_id as string);
  const [{ data: profiles }, { data: users }] = await Promise.all([
    supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
    supabase.from('users').select('id, subscription_tier').in('id', userIds),
  ]);

  const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const tierMap = new Map((users ?? []).map((u) => [u.id as string, u]));

  return members.map((row) => {
    const prof = profMap.get(row.user_id as string);
    const tier = tierMap.get(row.user_id as string);
    return {
      id: row.id as string,
      conversation_id: row.conversation_id as string,
      user_id: row.user_id as string,
      is_admin: row.is_admin as boolean,
      joined_at: row.joined_at as string,
      removed_at: (row.removed_at as string | null) ?? null,
      removed_by: (row.removed_by as string | null) ?? null,
      user: {
        id: row.user_id as string,
        display_name: (prof?.display_name as string | null) ?? null,
        avatar_url: (prof?.avatar_url as string | null) ?? null,
        subscription_tier: (tier?.subscription_tier as string) ?? 'FREE',
      },
    };
  });
}

async function memberDisplayName(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.display_name as string | undefined) ?? 'Member';
}

async function assertAdmin(conversationId: string, actorId: string): Promise<void> {
  const { data } = await supabase
    .from('group_chat_members')
    .select('is_admin')
    .eq('conversation_id', conversationId)
    .eq('user_id', actorId)
    .is('removed_at', null)
    .maybeSingle();
  if (!data?.is_admin) throw new Error('Only group admins can manage members');
}

async function assertAcceptedGuest(planId: string, userId: string): Promise<void> {
  const { data } = await supabase
    .from('plan_offers')
    .select('id')
    .eq('plan_id', planId)
    .eq('bidder_id', userId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (!data) throw new Error('User must be an accepted guest on this plan');
}

export async function addGroupChatMember(
  conversationId: string,
  userId: string,
  addedBy: string,
  planId: string
): Promise<void> {
  await assertAdmin(conversationId, addedBy);
  await assertAcceptedGuest(planId, userId);

  const { error } = await supabase.from('group_chat_members').upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      is_admin: false,
      joined_at: new Date().toISOString(),
      removed_at: null,
      removed_by: null,
    },
    { onConflict: 'conversation_id,user_id' }
  );
  if (error) throw new Error(error.message);

  const name = await memberDisplayName(userId);
  await sendSystemMessage(conversationId, `${name} was added to the group`);
}

export async function removeGroupChatMember(
  conversationId: string,
  userId: string,
  removedBy: string
): Promise<void> {
  await assertAdmin(conversationId, removedBy);
  const name = await memberDisplayName(userId);
  const { error } = await supabase
    .from('group_chat_members')
    .update({ removed_at: new Date().toISOString(), removed_by: removedBy })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  await sendSystemMessage(conversationId, `${name} was removed from the group`);
}

export async function leaveGroupChat(conversationId: string, userId: string): Promise<void> {
  const { data: member } = await supabase
    .from('group_chat_members')
    .select('is_admin')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('removed_at', null)
    .maybeSingle();
  if (member?.is_admin) throw new Error('Group admins cannot leave — remove members instead');

  const name = await memberDisplayName(userId);
  const { error } = await supabase
    .from('group_chat_members')
    .update({ removed_at: new Date().toISOString(), removed_by: userId })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  await sendSystemMessage(conversationId, `${name} left the group`);
}
