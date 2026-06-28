import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  userId: string;
  onHiddenPlan: (planId: string) => void;
};

/**
 * Sync swipe-left passes across sessions when hidden_plans rows are inserted.
 */
export function subscribeDiscoverHiddenPlansRealtime({ userId, onHiddenPlan }: Options): () => void {
  if (!isSupabaseConfigured || !userId) return () => {};

  const channel: RealtimeChannel = supabase.channel(
    `discover-hidden:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'hidden_plans',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const planId = (payload.new as { plan_id?: string } | null)?.plan_id;
        if (planId) onHiddenPlan(planId);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
