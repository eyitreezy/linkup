import type { NotificationPayload } from '@/types/database';
import type { Href } from 'expo-router';

type Nav = { push: (href: Href) => void };

/**
 * Deep link from notification `data` (in-app + push tap). Paths are expo-router file routes.
 */
export function hrefFromNotificationPayload(data: NotificationPayload | null | undefined): Href | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.href === 'string' && data.href.startsWith('/')) {
    return data.href as Href;
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
  if (t.startsWith('kyc_')) {
    router.push('/kyc' as Href);
    return;
  }
  if (t === 'dispute_opened' || t === 'report_submitted') {
    router.push('/support' as Href);
    return;
  }
  /** Only open the inbox when we know this tap maps to a notification row (has a type). Empty payloads must not navigate (avoids stray pushes during auth / OAuth). */
  if (t.trim()) {
    router.push('/notifications' as Href);
  }
}
