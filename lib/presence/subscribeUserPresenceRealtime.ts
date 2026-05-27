import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbUserPresence } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Fresh channel name per subscription — avoids `.on()` after `subscribe()` on reused topics. */
function presenceChannelTopic(userId: string): string {
  return `public-presence:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

export async function fetchUserPresence(userId: string): Promise<DbUserPresence | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.from('user_presence').select('*').eq('user_id', userId).maybeSingle();
  return (data as DbUserPresence | null) ?? null;
}

/**
 * Subscribe to `user_presence` for one user. Register handlers before `subscribe()`; tear down with returned cleanup.
 */
export function subscribeUserPresenceRealtime(
  userId: string,
  onChange: (row: DbUserPresence | null) => void
): () => void {
  if (!isSupabaseConfigured || !userId) return () => {};

  const topic = presenceChannelTopic(userId);
  const channel: RealtimeChannel = supabase.channel(topic);

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${userId}` },
    (payload) => {
      if (payload.eventType === 'DELETE') {
        onChange(null);
        return;
      }
      onChange(payload.new as DbUserPresence);
    }
  );

  channel.subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
