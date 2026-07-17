import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  offerId: string;
  onRefresh: () => void;
};

/** Live negotiation round inserts for a single offer thread. */
export function subscribeOfferRoundsRealtime({ offerId, onRefresh }: Options): () => void {
  if (!isSupabaseConfigured || !offerId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onRefresh();
    }, 180);
  };

  const channel: RealtimeChannel = supabase.channel(
    `offer-rounds:${offerId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'plan_offer_rounds',
        filter: `offer_id=eq.${offerId}`,
      },
      schedule
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        schedule();
      }
    });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };
}
