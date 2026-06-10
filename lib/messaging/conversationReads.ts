import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type ConversationReadRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  last_read_message_id: string | null;
  updated_at: string;
};

export async function fetchPeerReadCursor(
  conversationId: string,
  peerUserId: string
): Promise<ConversationReadRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('conversation_reads')
    .select('conversation_id, user_id, last_read_at, last_read_message_id, updated_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', peerUserId)
    .maybeSingle();
  if (error) return null;
  return (data as ConversationReadRow | null) ?? null;
}

export async function markConversationRead(
  conversationId: string,
  messageId?: string | null
): Promise<ConversationReadRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
    p_message_id: messageId ?? null,
  });
  if (error) return null;
  return (data as ConversationReadRow | null) ?? null;
}

/** True when peer's read cursor is at or past this outgoing message. */
export function isOutgoingMessageRead(
  messageCreatedAt: string,
  peerRead: ConversationReadRow | null | undefined
): boolean {
  if (!peerRead?.last_read_at) return false;
  return new Date(peerRead.last_read_at).getTime() >= new Date(messageCreatedAt).getTime();
}
