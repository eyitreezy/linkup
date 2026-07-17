import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

type Options = {
  planId: string;
  onRefresh: () => void;
  /** Apply offer row immediately (before debounced full sync). */
  onOffersChange?: (payload: RealtimePostgresChangesPayload<DbPlanOffer>) => void;
  /** Apply plan row immediately (before debounced full sync). */
  onPlanChange?: (payload: RealtimePostgresChangesPayload<DbPlan>) => void;
};

export function attachPlanOffersChannel({
  planId,
  onRefresh,
  onOffersChange,
  onPlanChange,
}: Options): () => void {
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
      (payload) => {
        onOffersChange?.(payload as RealtimePostgresChangesPayload<DbPlanOffer>);
        schedule();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'plans',
        filter: `id=eq.${planId}`,
      },
      (payload) => {
        onPlanChange?.(payload as RealtimePostgresChangesPayload<DbPlan>);
        schedule();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'plan_engagements',
        filter: `plan_id=eq.${planId}`,
      },
      schedule
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'escrow_transactions',
        filter: `plan_id=eq.${planId}`,
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

/** Live offer list updates on plan detail / negotiate screens. */
export function subscribePlanOffersRealtime(options: Options): () => void {
  return attachPlanOffersChannel(options);
}

/** React hook — stable subscription; callbacks read from refs (no resubscribe on render). */
export function usePlanOffersRealtimeSubscription(options: Options): void {
  const refreshRef = useRef(options.onRefresh);
  const offersChangeRef = useRef(options.onOffersChange);
  const planChangeRef = useRef(options.onPlanChange);
  refreshRef.current = options.onRefresh;
  offersChangeRef.current = options.onOffersChange;
  planChangeRef.current = options.onPlanChange;

  useEffect(() => {
    if (!options.planId || !isSupabaseConfigured) return;
    return attachPlanOffersChannel({
      planId: options.planId,
      onRefresh: () => refreshRef.current(),
      onOffersChange: (payload) => offersChangeRef.current?.(payload),
      onPlanChange: (payload) => planChangeRef.current?.(payload),
    });
  }, [options.planId]);
}
