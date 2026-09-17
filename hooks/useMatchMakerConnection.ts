import type { MatchMakerConnection } from '@/lib/matchmaker/types';
import { removeSupabaseChannel, supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export function useMatchMakerConnection(connectionId: string | null | undefined) {
  const [connection, setConnection] = useState<MatchMakerConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connectionId) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('matchmaker_connections')
      .select(
        'id, status, connected_at, first_message_at, plan_unlock_at, first_plan_created_at, ended_at, user_a_id, user_b_id'
      )
      .eq('id', connectionId)
      .maybeSingle();
    if (qErr) setError(qErr.message);
    else setConnection((data as MatchMakerConnection | null) ?? null);
    setLoading(false);
  }, [connectionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!connectionId) return;
    const channel = supabase
      .channel(`mm-connection-${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchmaker_connections',
          filter: `id=eq.${connectionId}`,
        },
        (payload) => {
          setConnection((prev) => ({ ...(prev ?? {}), ...(payload.new as MatchMakerConnection) }));
        }
      )
      .subscribe();
    return () => {
      removeSupabaseChannel(channel);
    };
  }, [connectionId]);

  return { connection, loading, error, refresh };
}
