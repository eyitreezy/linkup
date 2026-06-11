import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ConversationPinState } from '@/lib/messaging/conversationPin';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConversationRealtimeHandlers = {
  onPinChange: (pin: ConversationPinState) => void;
};

function conversationChannelTopic(conversationId: string): string {
  return `conversation:${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

/** Realtime updates on `conversations` (e.g. pinned message changes). */
export function subscribeConversationRealtime(
  conversationId: string,
  handlers: ConversationRealtimeHandlers
): () => void {
  if (!isSupabaseConfigured || !conversationId) return () => {};

  const channel: RealtimeChannel = supabase.channel(conversationChannelTopic(conversationId));

  channel
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        handlers.onPinChange({
          pinnedMessageId: (row.pinned_message_id as string | null | undefined) ?? null,
          pinnedAt: (row.pinned_at as string | null | undefined) ?? null,
          pinnedBy: (row.pinned_by as string | null | undefined) ?? null,
        });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
