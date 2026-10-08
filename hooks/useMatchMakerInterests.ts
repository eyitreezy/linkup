import { fetchMatchMakerInterestQueue } from '@/lib/matchmaker/interests';
import type { MatchMakerInterestQueue } from '@/lib/matchmaker/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

const EMPTY_QUEUE: MatchMakerInterestQueue = { sent: [], received: [] };

export function useMatchMakerInterests(userId: string | undefined) {
  const [queue, setQueue] = useState<MatchMakerInterestQueue>(EMPTY_QUEUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setQueue(EMPTY_QUEUE);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const next = await fetchMatchMakerInterestQueue(userId);
      setQueue(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load interests');
      setQueue(EMPTY_QUEUE);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  loadRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadRef.current();

      if (!userId || !isSupabaseConfigured) return () => {};

      let debounce: ReturnType<typeof setTimeout> | undefined;
      const channel = supabase
        .channel(`mm-interests-${userId}`)
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

  return {
    queue,
    loading,
    error,
    refresh,
    receivedCount: queue.received.length,
    sentCount: queue.sent.length,
  };
}
