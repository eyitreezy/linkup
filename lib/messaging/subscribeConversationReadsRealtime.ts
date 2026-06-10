import type { ConversationReadRow } from '@/lib/messaging/conversationReads';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

function readsChannelTopic(conversationId: string): string {
  return `conv-reads:${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

export function subscribeConversationReadsRealtime(
  conversationId: string,
  handlers: {
    onUpsert: (row: ConversationReadRow) => void;
  }
): () => void {
  if (!isSupabaseConfigured || !conversationId) return () => {};

  const channel: RealtimeChannel = supabase.channel(readsChannelTopic(conversationId));

  const handle = (payload: { new: Record<string, unknown> }) => {
    handlers.onUpsert(payload.new as ConversationReadRow);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      handle
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      handle
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
