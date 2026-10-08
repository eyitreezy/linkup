import type { SharedActivityRpcState } from '@/lib/matchmaker/sharedActivity';
import { sharedActivityPhaseFromState } from '@/lib/matchmaker/sharedActivity';
import { removeSupabaseChannel, supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export type SharedActivityPhase = 'question' | 'waiting' | 'reveal';

export type SharedActivityRow = SharedActivityRpcState;

export function useMatchMakerActivity(
  connectionId: string | null | undefined,
  viewerId: string | undefined,
  isUserA: boolean,
  weekNumber = 1
) {
  const [activity, setActivity] = useState<SharedActivityRpcState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!connectionId) {
      setActivity(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('matchmaker_get_shared_activity_state', {
      p_connection_id: connectionId,
      p_week_number: weekNumber,
    });
    if (error) {
      setActivity(null);
    } else {
      setActivity((data as SharedActivityRpcState | null) ?? null);
    }
    setLoading(false);
  }, [connectionId, weekNumber]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!connectionId) return;
    const channel = supabase
      .channel(`mm-activity-refresh-${connectionId}-${weekNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${viewerId ?? ''}`,
        },
        (payload) => {
          const row = payload.new as { type?: string; data?: { connection_id?: string } };
          if (
            row?.type === 'matchmaker_activity_shared' ||
            row?.type === 'matchmaker_activity_revealed'
          ) {
            if (row.data?.connection_id === connectionId) void refresh();
          }
        }
      )
      .subscribe();
    return () => {
      removeSupabaseChannel(channel);
    };
  }, [connectionId, weekNumber, refresh, viewerId]);

  const phase: SharedActivityPhase = sharedActivityPhaseFromState(activity, isUserA);

  return { activity, phase, loading, refresh, viewerId };
}
