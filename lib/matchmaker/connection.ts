import type { MatchMakerConnection } from '@/lib/matchmaker/types';

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function partnerUserId(connection: MatchMakerConnection, viewerId: string): string {
  return connection.user_a_id === viewerId ? connection.user_b_id : connection.user_a_id;
}

export function isPlanWindowUnlocked(connection: MatchMakerConnection): boolean {
  if (connection.first_plan_created_at) return true;
  if (!connection.plan_unlock_at) return false;
  return new Date(connection.plan_unlock_at).getTime() <= Date.now();
}

export function planUnlockCountdownLabel(connection: MatchMakerConnection): string | null {
  if (connection.first_plan_created_at) return null;
  if (!connection.first_message_at) return 'Send the first message to start your 21-day journey';
  if (!connection.plan_unlock_at) return null;
  const diff = new Date(connection.plan_unlock_at).getTime() - Date.now();
  if (diff <= 0) return 'Plan window is open';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `Plan window opens in ${days} day${days === 1 ? '' : 's'}`;
}

export type JourneyMilestone = {
  label: string;
  done: boolean;
  active?: boolean;
  dateLabel?: string;
};

export function buildJourneyMilestones(
  connection: MatchMakerConnection,
  activityCompleted?: boolean
): JourneyMilestone[] {
  const days = daysSince(connection.connected_at);
  const planOpen = isPlanWindowUnlocked(connection);
  return [
    { label: 'Connected', done: true, dateLabel: formatShortDate(connection.connected_at) },
    {
      label: 'First message (starts 21-day plan clock)',
      done: !!connection.first_message_at,
      active: !connection.first_message_at,
    },
    {
      label: 'Day 7 from connected_at — Shared Activity',
      done: days >= 7 && !!activityCompleted,
      active: days >= 7 && !activityCompleted,
    },
    { label: 'Day 10 from connected_at — Check-in', done: days >= 10 },
    {
      label: 'Day 21 from first_message_at — Plan window opens',
      done: planOpen,
      active: !!connection.first_message_at && !planOpen,
    },
  ];
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
