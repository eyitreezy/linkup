import {
  fetchMatchMakerInterestRelation,
  type MatchMakerInterestRelation,
} from '@/lib/matchmaker/interestRelation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

const EMPTY: MatchMakerInterestRelation = {
  state: 'none',
  interestStatus: null,
  canExpress: true,
  canPass: true,
  connectionId: undefined,
};

export function useMatchMakerInterestRelation(
  viewerId: string | undefined,
  targetUserId: string | undefined
) {
  const [relation, setRelation] = useState<MatchMakerInterestRelation>(EMPTY);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    if (!viewerId || !targetUserId || !isSupabaseConfigured) {
      setRelation(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchMatchMakerInterestRelation(targetUserId);
      setRelation(next);
    } catch {
      setRelation(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [viewerId, targetUserId]);

  loadRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();

      if (!viewerId || !targetUserId || !isSupabaseConfigured) return () => {};

      let debounce: ReturnType<typeof setTimeout> | undefined;
      const channel = supabase
        .channel(`mm-relation-${viewerId}-${targetUserId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matchmaker_interests' },
          () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => void loadRef.current(), 180);
          }
        )
        .subscribe();

      return () => {
        if (debounce) clearTimeout(debounce);
        void supabase.removeChannel(channel);
      };
    }, [viewerId, targetUserId])
  );

  return { relation, loading, refresh };
}
