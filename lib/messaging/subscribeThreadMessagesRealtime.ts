import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ChatMessageRow } from '@/lib/messaging/chatQueries';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ThreadMessageRealtimeHandlers = {
  onInsert: (row: ChatMessageRow) => void | Promise<void>;
  onUpdate: (row: ChatMessageRow) => void | Promise<void>;
  onDelete: (messageId: string) => void;
};

/** Unique topic per subscription — avoids `.on()` after `subscribe()` on reused channel names. */
function threadChannelTopic(conversationId: string): string {
  return `thread-messages:${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Realtime `messages` for one conversation. All `postgres_changes` handlers are registered before `subscribe()`.
 */
export function subscribeThreadMessagesRealtime(
  conversationId: string,
  handlers: ThreadMessageRealtimeHandlers
): () => void {
  if (!isSupabaseConfigured || !conversationId) return () => {};

  const channel: RealtimeChannel = supabase.channel(threadChannelTopic(conversationId));

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        void handlers.onInsert(payload.new as ChatMessageRow);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        void handlers.onUpdate(payload.new as ChatMessageRow);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) handlers.onDelete(id);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
