import { fetchMatchMakerGateState, gateRouteFor } from '@/lib/matchmaker/gates';
import type { MatchMakerGateState } from '@/lib/matchmaker/types';
import { useCallback, useEffect, useState } from 'react';

export function useMatchMakerGate() {
  const [state, setState] = useState<MatchMakerGateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchMatchMakerGateState();
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load MatchMaker');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    loading,
    error,
    refresh,
    route: state ? gateRouteFor(state) : '/matchmaker/pool',
  };
}
