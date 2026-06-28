import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  userId: string;
  onRefreshOffers: () => void;
};

/**
 * Refreshes offer badges on discover list/swipe cards when the viewer's offers change.
 */
export function subscribeDiscoverOffersRealtime({ userId, onRefreshOffers }: Options): () => void {
  if (!isSupabaseConfigured || !userId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onRefreshOffers();
    }, 150);
  };

  const channel: RealtimeChannel = supabase.channel(
    `discover-offers:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'plan_offers',
        filter: `bidder_id=eq.${userId}`,
      },
      schedule
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'plan_offers',
        filter: `bidder_id=eq.${userId}`,
      },
      schedule
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'plan_offers',
        filter: `bidder_id=eq.${userId}`,
      },
      schedule
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };
}
