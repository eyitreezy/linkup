import type { NotificationPayload } from '@/types/database';
import type { Href } from 'expo-router';

type Nav = { push: (href: Href) => void };

/**
 * Deep link from notification `data` (in-app + push tap). Paths are expo-router file routes.
 */
export function hrefFromNotificationPayload(data: NotificationPayload | null | undefined): Href | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.href === 'string' && data.href.startsWith('/')) {
    const adminTab = typeof data.adminTab === 'string' ? data.adminTab : undefined;
    if (data.href === '/admin' && adminTab) {
      return `/admin?tab=${adminTab}` as Href;
    }
    return data.href as Href;
  }
  if (typeof data.ticketId === 'string' && data.ticketId.length > 0) {
    return `/support/ticket/${data.ticketId}` as Href;
  }
  if (data.chatId) return `/chat/${data.chatId}` as Href;
  if (data.escrowId) return `/escrow/${data.escrowId}` as Href;
  if (data.planId) return `/plan/${data.planId}` as Href;
  if (data.disputeId) return '/disputes' as Href;
  return null;
}

export function navigateFromNotification(router: Nav, data: NotificationPayload | null | undefined) {
  const tEarly = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (tEarly === 'premium_activated') {
    router.push('/premium/success' as Href);
    return;
  }

  const href = hrefFromNotificationPayload(data);
  if (href) {
    router.push(href);
    return;
  }
  const t = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (t === 'verification_submitted' || t === 'verification_updated') {
    router.push('/settings/verification' as Href);
    return;
  }
  if (t.startsWith('kyc_')) {
    router.push('/settings/verification' as Href);
    return;
  }
  if (t === 'dispute_opened') {
    router.push('/support' as Href);
    return;
  }
  if (t === 'credit_issued' || t === 'credit_expiring') {
    router.push('/wallet' as Href);
    return;
  }
  if (t === 'trial_started' || t === 'trial_expiring' || t === 'trial_expired') {
    router.push('/subscription' as Href);
    return;
  }
  if (t === 'report_submitted' || t === 'moderation_flagged' || t === 'meet_type_submitted') {
    const adminTab =
      data && typeof data === 'object' && typeof (data as { adminTab?: string }).adminTab === 'string'
        ? (data as { adminTab: string }).adminTab
        : t === 'meet_type_submitted'
          ? 'meet_types'
          : undefined;
    router.push((adminTab ? `/admin?tab=${adminTab}` : '/admin') as Href);
    return;
  }
  if (t === 'meet_type_approved' || t === 'meet_type_rejected') {
    router.push('/plan/create' as Href);
    return;
  }
  /** Only open the inbox when we know this tap maps to a notification row (has a type). Empty payloads must not navigate (avoids stray pushes during auth / OAuth). */
  if (t.trim()) {
    router.push('/notifications' as Href);
  }
}
