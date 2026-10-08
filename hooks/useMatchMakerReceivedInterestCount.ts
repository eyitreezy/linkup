import { fetchMatchMakerUnopenedReceivedCount } from '@/lib/matchmaker/interests';
import {
  getMatchMakerInterestQueueLastOpenedAt,
  subscribeMatchMakerInterestBadgeRefresh,
} from '@/lib/matchmaker/interestQueueSeen';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Unopened pending received interests — tab bar + pool header badge (spec §2.4). */
export function useMatchMakerReceivedInterestCount(userId: string | undefined) {
  const [count, setCount] = useState(0);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setCount(0);
      return;
    }
    try {
      const lastOpenedAt = await getMatchMakerInterestQueueLastOpenedAt(userId);
      const next = await fetchMatchMakerUnopenedReceivedCount(userId, lastOpenedAt);
      setCount(next);
    } catch {
      setCount(0);
    }
  }, [userId]);

  loadRef.current = refresh;

  useEffect(() => subscribeMatchMakerInterestBadgeRefresh(() => void loadRef.current()), []);

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();

      if (!userId || !isSupabaseConfigured) return () => {};

      let debounce: ReturnType<typeof setTimeout> | undefined;
      const channel = supabase
        .channel(`mm-interest-count-${userId}`)
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
    }, [userId])
  );

  return count;
}
