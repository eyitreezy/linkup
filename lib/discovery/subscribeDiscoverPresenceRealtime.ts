import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbUserPresence } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  /** Only apply updates for creators currently visible in the feed. */
  isTrackedCreator: (userId: string) => boolean;
  onPresenceChange: (row: DbUserPresence) => void;
};

/**
 * Host online / last-seen dots on discover cards — patches in place without refetching plans.
 */
export function subscribeDiscoverPresenceRealtime({
  isTrackedCreator,
  onPresenceChange,
}: Options): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel: RealtimeChannel = supabase.channel(
    `discover-presence:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );

  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'user_presence' },
      (payload) => {
        const row = payload.new as DbUserPresence;
        if (row?.user_id && isTrackedCreator(row.user_id)) {
          onPresenceChange(row);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_presence' },
      (payload) => {
        const row = payload.new as DbUserPresence;
        if (row?.user_id && isTrackedCreator(row.user_id)) {
          onPresenceChange(row);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
