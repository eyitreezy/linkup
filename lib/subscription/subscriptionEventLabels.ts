import type { DbSubscriptionEvent } from '@/types/database';
import type { IonName } from '@/lib/notifications/notificationIcon';

export const HIDDEN_SUBSCRIPTION_EVENT_TYPES = new Set(['trial_expiring_notified']);

export const EVENT_LABELS: Record<string, (e: DbSubscriptionEvent) => string | null> = {
  trial_started: (e) =>
    `${e.metadata?.trial_type === 'gold_7_day' ? 'Gold' : 'Silver'} trial started`,
  trial_expired: (e) =>
    `${e.metadata?.trial_type === 'gold_7_day' ? 'Gold' : 'Silver'} trial ended`,
  trial_expiring_notified: () => null,
  subscription_created: (e) => `Subscribed to ${e.to_tier ?? 'plan'}`,
  subscription_renewed: (e) => `${e.to_tier ?? 'Plan'} subscription renewed`,
  subscription_upgraded: (e) => `Upgraded to ${e.to_tier ?? 'plan'}`,
  subscription_downgraded: (e) => `Downgraded to ${e.to_tier ?? 'plan'}`,
  subscription_cancelled: () => 'Subscription cancelled',
  subscription_expired: (e) => `${e.from_tier ?? 'Plan'} subscription expired`,
  payment_failed: () => 'Payment failed',
  payment_succeeded: () => 'Payment received',
  admin_trial_grant: (e) => `Admin granted ${formatTrialType(e.metadata?.trial_type)} trial`,
  admin_trial_extend: (e) => `Admin extended ${formatTrialType(e.metadata?.trial_type)} trial`,
  admin_trial_revoke: (e) => `Admin revoked ${formatTrialType(e.metadata?.trial_type)} trial`,
};

function formatTrialType(raw: unknown): string {
  if (raw === 'gold_7_day') return 'Gold';
  if (raw === 'silver_7_day') return 'Silver';
  return String(raw ?? 'trial');
}

export function subscriptionEventLabel(event: DbSubscriptionEvent): string | null {
  const fn = EVENT_LABELS[event.event_type];
  if (!fn) return event.event_type.replace(/_/g, ' ');
  return fn(event);
}

export function subscriptionEventIcon(eventType: string): IonName {
  if (eventType.startsWith('trial_') || eventType.startsWith('admin_trial_')) return 'sparkles-outline';
  if (eventType.startsWith('payment_')) return 'card-outline';
  if (eventType === 'subscription_upgraded') return 'arrow-up-outline';
  if (eventType === 'subscription_downgraded') return 'arrow-down-outline';
  if (eventType.startsWith('subscription_')) return 'diamond-outline';
  return 'notifications-outline';
}

export function formatSubscriptionEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
