import { OFFER_ACTION_LABELS } from '@/lib/plans/negotiationState';

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatRoundSentAt(iso: string): { absolute: string; relative: string } {
  const d = new Date(iso);
  return {
    absolute: d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    relative: formatRelativeTime(iso),
  };
}

export function formatRoundAmount(cents: number | null | undefined, currency: string): string {
  if (cents == null || cents <= 0) return 'Open amount';
  const n = cents / 100;
  if (currency === 'NGN') return `₦${n.toLocaleString()}`;
  return `${n.toFixed(0)} ${currency}`;
}

export function formatRoundRoleLabel(role: 'host' | 'guest', mine: boolean): string {
  if (mine) return 'You';
  return role === 'host' ? 'Host' : 'Guest';
}

export function formatRoundActionHeadline(action: string): string {
  return OFFER_ACTION_LABELS[action] ?? action;
}
