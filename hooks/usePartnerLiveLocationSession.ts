import { useEffect, useState } from 'react';
import { removeSupabaseChannel, supabase } from '@/lib/supabase';

/** Subscribe to active live location sessions for a plan (partner sharing). */
export function usePartnerLiveLocationSession(planId: string | null, currentUserId: string | undefined) {
  const [partnerSessionId, setPartnerSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!planId || !currentUserId) {
      setPartnerSessionId(null);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from('live_location_sessions')
        .select('id, sharer_id, is_active')
        .eq('plan_id', planId)
        .eq('is_active', true)
        .neq('sharer_id', currentUserId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPartnerSessionId(data?.id ?? null);
    };

    void load();

    const channel = supabase
      .channel(`live-location-sessions-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_location_sessions',
          filter: `plan_id=eq.${planId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      removeSupabaseChannel(channel);
    };
  }, [planId, currentUserId]);

  return partnerSessionId;
}
