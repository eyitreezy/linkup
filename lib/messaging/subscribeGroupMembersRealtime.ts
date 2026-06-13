import { fetchActiveGroupMembers, type GroupChatMemberRow } from '@/lib/messaging/groupChatMembers';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export function subscribeGroupMembersRealtime(
  conversationId: string,
  onMemberChange: (members: GroupChatMemberRow[]) => void
): () => void {
  if (!isSupabaseConfigured || !conversationId) return () => {};

  const channel = supabase.channel(`group-members:${conversationId}:${Date.now()}`);

  const refetch = () => {
    void fetchActiveGroupMembers(conversationId).then(onMemberChange);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'group_chat_members',
        filter: `conversation_id=eq.${conversationId}`,
      },
      refetch
    )
    .subscribe();

  void fetchActiveGroupMembers(conversationId).then(onMemberChange);

  return () => {
    void supabase.removeChannel(channel);
  };
}
