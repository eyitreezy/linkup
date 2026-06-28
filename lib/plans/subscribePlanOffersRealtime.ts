import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  planId: string;
  onRefresh: () => void;
};

/** Live offer list updates on plan detail / negotiate screens. */
export function subscribePlanOffersRealtime({ planId, onRefresh }: Options): () => void {
  if (!isSupabaseConfigured || !planId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onRefresh();
    }, 180);
  };

  const channel: RealtimeChannel = supabase.channel(
    `plan-offers:${planId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'plan_offers',
        filter: `plan_id=eq.${planId}`,
      },
      schedule
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };
}
