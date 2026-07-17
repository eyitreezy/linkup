import { subscribeOfferRoundsRealtime } from '@/lib/plans/subscribeOfferRoundsRealtime';
import { attachPlanOffersChannel } from '@/lib/plans/subscribePlanOffersRealtime';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { DbPlanOffer } from '@/types/database';

type Options = {
  planId: string;
  /** When set, also listen for round changes scoped to this offer. */
  offerId?: string | null;
  onRefresh: () => void;
  onOffersChange?: (payload: RealtimePostgresChangesPayload<DbPlanOffer>) => void;
};

type RoundsOptions = {
  planId: string;
  offerId?: string | null;
  onRefresh: () => void;
};

/** Negotiation round changes only — keep separate from offer list subscription. */
export function attachPlanNegotiationRoundsChannels({
  planId,
  offerId,
  onRefresh,
}: RoundsOptions): () => void {
  if (!isSupabaseConfigured || !planId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onRefresh();
    }, 160);
  };

  const cleanups: Array<() => void> = [];

  if (offerId) {
    cleanups.push(subscribeOfferRoundsRealtime({ offerId, onRefresh: schedule }));
  }

  let planRoundsChannel: RealtimeChannel | null = null;
  planRoundsChannel = supabase.channel(
    `plan-offer-rounds:${planId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  );
  planRoundsChannel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'plan_offer_rounds',
        filter: `plan_id=eq.${planId}`,
      },
      schedule
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        schedule();
      }
    });

  cleanups.push(() => {
    if (planRoundsChannel) void supabase.removeChannel(planRoundsChannel);
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    for (const fn of cleanups) fn();
  };
}

function attachPlanNegotiationChannels({
  planId,
  offerId,
  onRefresh,
  onOffersChange,
}: Options): () => void {
  if (!isSupabaseConfigured || !planId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onRefresh();
    }, 160);
  };

  const cleanups: Array<() => void> = [
    attachPlanOffersChannel({ planId, onRefresh: schedule, onOffersChange }),
    attachPlanNegotiationRoundsChannels({ planId, offerId, onRefresh: schedule }),
  ];

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    for (const fn of cleanups) fn();
  };
}

/**
 * Live negotiation updates: offer row changes + history rounds (plan-wide and per-offer).
 */
export function subscribePlanNegotiationRealtime(options: Options): () => void {
  return attachPlanNegotiationChannels(options);
}

/** React hook — stable offer subscription; rounds resubscribe when offerId changes. */
export function usePlanNegotiationRealtimeSubscription(options: Options): void {
  const refreshRef = useRef(options.onRefresh);
  const offersChangeRef = useRef(options.onOffersChange);
  refreshRef.current = options.onRefresh;
  offersChangeRef.current = options.onOffersChange;

  useEffect(() => {
    if (!options.planId || !isSupabaseConfigured) return;
    return attachPlanOffersChannel({
      planId: options.planId,
      onRefresh: () => refreshRef.current(),
      onOffersChange: (payload) => offersChangeRef.current?.(payload),
    });
  }, [options.planId]);

  useEffect(() => {
    if (!options.planId || !isSupabaseConfigured) return;
    return attachPlanNegotiationRoundsChannels({
      planId: options.planId,
      offerId: options.offerId ?? null,
      onRefresh: () => refreshRef.current(),
    });
  }, [options.planId, options.offerId ?? '']);
}
