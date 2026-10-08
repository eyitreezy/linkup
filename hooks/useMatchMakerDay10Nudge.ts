import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCheckInConversationStarter } from '@/lib/matchmaker/conversationStarter';
import { computeMatchMakerJourneyClocks } from '@/lib/matchmaker/journey';
import type { MatchMakerConnection } from '@/lib/matchmaker/types';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

const DISMISS_PREFIX = 'mm_day10_nudge_dismissed:';

export type Day10NudgeView = {
  visible: boolean;
  silentPartner: boolean;
  planDaysRemaining: number | null;
  conversationStarter: string;
  nudgeId: string | null;
};

const EMPTY: Day10NudgeView = {
  visible: false,
  silentPartner: false,
  planDaysRemaining: null,
  conversationStarter: '',
  nudgeId: null,
};

export function useMatchMakerDay10Nudge(
  connection: MatchMakerConnection | null,
  viewerId: string | undefined,
  partner: { display_name: string | null; preferences?: { interests?: string[] } } | null,
  conversationId: string | null
) {
  const [nudge, setNudge] = useState<Day10NudgeView>(EMPTY);

  const refresh = useCallback(async () => {
    if (!connection || !viewerId || connection.status !== 'active') {
      setNudge(EMPTY);
      return;
    }

    const clocks = computeMatchMakerJourneyClocks(connection);
    if (!clocks.checkInUnlocked) {
      setNudge(EMPTY);
      return;
    }

    const { data: row } = await supabase
      .from('matchmaker_nudges')
      .select('id')
      .eq('connection_id', connection.id)
      .eq('user_id', viewerId)
      .eq('nudge_type', 'day_10_checkin')
      .maybeSingle();

    if (!row?.id) {
      setNudge(EMPTY);
      return;
    }

    const dismissed = await AsyncStorage.getItem(`${DISMISS_PREFIX}${row.id}`);
    if (dismissed === '1') {
      setNudge(EMPTY);
      return;
    }

    let silentPartner = false;
    if (conversationId) {
      const cutoff = new Date(Date.now() - 5 * 86400000).toISOString();
      const { data: recent } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .gte('created_at', cutoff)
        .limit(1);
      silentPartner = !recent || recent.length === 0;
    }

    const partnerName = partner?.display_name?.trim() || 'your match';
    const interests = partner?.preferences?.interests ?? [];

    setNudge({
      visible: true,
      silentPartner,
      planDaysRemaining: clocks.planDaysRemaining,
      conversationStarter: buildCheckInConversationStarter(partnerName, interests),
      nudgeId: row.id,
    });
  }, [connection, viewerId, partner, conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(async () => {
    if (nudge.nudgeId) {
      await AsyncStorage.setItem(`${DISMISS_PREFIX}${nudge.nudgeId}`, '1');
    }
    setNudge(EMPTY);
  }, [nudge.nudgeId]);

  return { nudge, dismiss, refresh };
}
