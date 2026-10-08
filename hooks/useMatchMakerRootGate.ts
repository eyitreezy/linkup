import {
  fetchMatchMakerGateState,
  gateRouteFor,
  MATCHMAKER_GATED_MODAL,
} from '@/lib/matchmaker/gates';
import type { MatchMakerGate, MatchMakerGateState } from '@/lib/matchmaker/types';
import { matchmakerPoolGender } from '@/lib/profile/gender';
import { supabase } from '@/lib/supabase';
import { useCallback, useState } from 'react';

export function useMatchMakerRootGate(userId: string | undefined, refreshProfile: () => Promise<void>) {
  const [gateState, setGateState] = useState<MatchMakerGateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshProfile();
      const data = await fetchMatchMakerGateState();
      let resolved: MatchMakerGateState = data;

      if ((data.gate === 'pool' || data.gate === 'open') && userId) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('gender')
          .eq('user_id', userId)
          .maybeSingle();
        if (matchmakerPoolGender(profileRow?.gender) == null) {
          resolved = { ...data, gate: 'gender_not_set' };
        }
      }

      setGateState(resolved);
      return resolved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load MatchMaker');
      setGateState(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [refreshProfile, userId]);

  const route = gateState ? gateRouteFor(gateState) : null;
  const isModalGated =
    gateState != null && MATCHMAKER_GATED_MODAL.includes(gateState.gate as MatchMakerGate);

  return { gateState, loading, error, refresh, route, isModalGated };
}
