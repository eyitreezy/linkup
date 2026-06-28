/**
 * Realtime refresh for the Messages tab inbox — new/edited/deleted messages, reads, deletions.
 */
import { supabase } from '@/lib/supabase';

type InboxRealtimeOptions = {
  userId: string;
  onChange: () => void;
};

export function subscribeInboxRealtime({ userId, onChange }: InboxRealtimeOptions): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChange();
    }, 280);
  };

  const topic = `inbox-user:${userId}:${Date.now()}`;
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversation_reads' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_user_deletions' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'conversations' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'conversations' },
      scheduleRefresh
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };
}
