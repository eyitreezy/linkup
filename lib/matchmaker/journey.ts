import type { MatchMakerConnection } from '@/lib/matchmaker/types';
import { daysSince } from '@/lib/matchmaker/connection';

export const MM_JOURNEY = {
  sharedActivityDay: 7,
  checkInDay: 10,
  readySignalDay: 10,
  planWindowDaysFromFirstMessage: 21,
} as const;

export type MatchMakerJourneyClocks = {
  daysConnected: number;
  daysSinceFirstMessage: number | null;
  planWindowOpen: boolean;
  sharedActivityUnlocked: boolean;
  checkInUnlocked: boolean;
  readySignalUnlocked: boolean;
  planDaysRemaining: number | null;
  planUnlockCalendarDay: number | null;
};

export function computeMatchMakerJourneyClocks(
  connection: MatchMakerConnection,
  nowMs = Date.now()
): MatchMakerJourneyClocks {
  const daysConnected = daysSince(connection.connected_at);
  const daysSinceFirstMessage = connection.first_message_at
    ? daysSince(connection.first_message_at)
    : null;

  const planWindowOpen =
    !!connection.first_plan_created_at ||
    (!!connection.plan_unlock_at &&
      new Date(connection.plan_unlock_at).getTime() <= nowMs);

  let planDaysRemaining: number | null = null;
  if (connection.plan_unlock_at && !planWindowOpen) {
    const diff = new Date(connection.plan_unlock_at).getTime() - nowMs;
    planDaysRemaining = Math.max(0, Math.ceil(diff / 86400000));
  }

  const planUnlockCalendarDay =
    connection.first_message_at != null
      ? MM_JOURNEY.planWindowDaysFromFirstMessage
      : null;

  return {
    daysConnected,
    daysSinceFirstMessage,
    planWindowOpen,
    sharedActivityUnlocked: daysConnected >= MM_JOURNEY.sharedActivityDay,
    checkInUnlocked: daysConnected >= MM_JOURNEY.checkInDay,
    readySignalUnlocked: daysConnected >= MM_JOURNEY.readySignalDay,
    planDaysRemaining,
    planUnlockCalendarDay,
  };
}

export function planCreateLockedExplanation(
  connection: MatchMakerConnection,
  clocks: MatchMakerJourneyClocks
): string {
  if (clocks.planWindowOpen || connection.first_plan_created_at) {
    return 'Plan window is open';
  }
  if (!connection.first_message_at) {
    return 'Send the first message to start your 21-day journey';
  }
  if (clocks.planDaysRemaining != null && clocks.planDaysRemaining > 0) {
    return `This unlocks on Day ${MM_JOURNEY.planWindowDaysFromFirstMessage}. Plan window opens in ${clocks.planDaysRemaining} day${clocks.planDaysRemaining === 1 ? '' : 's'}.`;
  }
  return `This unlocks on Day ${MM_JOURNEY.planWindowDaysFromFirstMessage}.`;
}

export function featureLockedExplanation(
  feature: 'shared_activity' | 'ready_signal' | 'create_plan',
  clocks: MatchMakerJourneyClocks,
  connection: MatchMakerConnection
): string {
  switch (feature) {
    case 'shared_activity':
      return clocks.sharedActivityUnlocked
        ? ''
        : `This unlocks on Day ${MM_JOURNEY.sharedActivityDay}.`;
    case 'ready_signal':
      return clocks.readySignalUnlocked
        ? ''
        : `This unlocks on Day ${MM_JOURNEY.readySignalDay}.`;
    case 'create_plan':
      return planCreateLockedExplanation(connection, clocks);
    default:
      return '';
  }
}
