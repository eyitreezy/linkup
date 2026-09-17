import { removeSupabaseChannel, supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export type SharedActivityPhase = 'question' | 'waiting' | 'reveal';

export type SharedActivityRow = {
  id: string;
  connection_id: string;
  week_number: number;
  questions: unknown;
  user_a_answers: unknown;
  user_b_answers: unknown;
  a_submitted_at: string | null;
  b_submitted_at: string | null;
  revealed_at: string | null;
};

export function useMatchMakerActivity(
  connectionId: string | null | undefined,
  viewerId: string | undefined,
  isUserA: boolean,
  weekNumber = 1
) {
  const [activity, setActivity] = useState<SharedActivityRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!connectionId) {
      setActivity(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('matchmaker_shared_activities')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('week_number', weekNumber)
      .maybeSingle();
    setActivity((data as SharedActivityRow | null) ?? null);
    setLoading(false);
  }, [connectionId, weekNumber]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!connectionId) return;
    const channel = supabase
      .channel(`mm-activity-${connectionId}-${weekNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaker_shared_activities',
          filter: `connection_id=eq.${connectionId}`,
        },
        () => void refresh()
      )
      .subscribe();
    return () => removeSupabaseChannel(channel);
  }, [connectionId, weekNumber, refresh]);

  const phase: SharedActivityPhase = (() => {
    if (!activity) return 'question';
    if (activity.revealed_at) return 'reveal';
    const mineSubmitted = isUserA ? activity.a_submitted_at : activity.b_submitted_at;
    if (mineSubmitted) return 'waiting';
    return 'question';
  })();

  return { activity, phase, loading, refresh, viewerId };
}
