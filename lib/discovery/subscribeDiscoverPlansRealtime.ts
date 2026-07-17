import { shouldRemovePlanFromDiscoverFeed } from '@/lib/discovery/discoverPlanFeedRealtime';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type DiscoverPlanUpdateRow = {
  id?: string;
  status?: string;
  is_group_plan?: boolean;
  is_suppressed?: boolean;
  archived_at?: string | null;
};

export type DiscoverPlansRealtimeOptions = {
  userId?: string;
  onRemovePlan: (planId: string) => void;
  /** Debounced — refetch/merge head page so new plans and field updates appear. */
  onRefreshPlans: () => void;
};

function discoverPlansChannelTopic(userId: string | undefined): string {
  return `discover-plans-rt:${userId ?? 'anon'}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Realtime plan changes for discover swipe deck + list (INSERT / UPDATE / DELETE).
 */
export function subscribeDiscoverPlansRealtime({
  userId,
  onRemovePlan,
  onRefreshPlans,
}: DiscoverPlansRealtimeOptions): () => void {
  if (!isSupabaseConfigured) return () => {};

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      onRefreshPlans();
    }, 420);
  };

  const channel: RealtimeChannel = supabase.channel(discoverPlansChannelTopic(userId));

  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plans' },
      () => {
        scheduleRefresh();
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'plans' },
      (payload) => {
        const row = payload.new as DiscoverPlanUpdateRow;
        if (!row?.id) return;
        if (shouldRemovePlanFromDiscoverFeed(row)) {
          onRemovePlan(row.id);
          return;
        }
        scheduleRefresh();
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'plans' },
      (payload) => {
        const id = (payload.old as { id?: string } | null)?.id;
        if (id) onRemovePlan(id);
      }
    )
    .subscribe();

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabase.removeChannel(channel);
  };
}
