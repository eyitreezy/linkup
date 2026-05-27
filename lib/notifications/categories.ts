import type { NotificationEventType } from '@/types/database';

export type NotificationFilterTab = 'all' | 'activity' | 'payments' | 'system';

const ACTIVITY: NotificationEventType[] = [
  'offer_new',
  'offer_counter',
  'mutual_agreement',
  'plan_reminder',
  'message',
];

const PAYMENTS: NotificationEventType[] = [
  'escrow_funded',
  'escrow_status',
  'completion_release',
  'cancel_chargeback',
  'dispute_opened',
];

const SYSTEM: NotificationEventType[] = [
  'kyc_submitted',
  'kyc_decision',
  'verification_submitted',
  'verification_updated',
  'moderation_flagged',
  'account_restriction',
  'report_submitted',
  'premium_activated',
];

export function notificationTab(type: string): NotificationFilterTab {
  if (ACTIVITY.includes(type as NotificationEventType)) return 'activity';
  if (PAYMENTS.includes(type as NotificationEventType)) return 'payments';
  if (SYSTEM.includes(type as NotificationEventType)) return 'system';
  if (type.startsWith('offer_') || type.startsWith('plan_')) return 'activity';
  if (type.startsWith('escrow_') || type.startsWith('dispute')) return 'payments';
  if (type.startsWith('kyc_') || type.startsWith('account_') || type.startsWith('verification_')) return 'system';
  return 'activity';
}

export function priorityForType(type: string): 'high' | 'medium' | 'low' {
  if (
    type === 'dispute_opened' ||
    type === 'cancel_chargeback' ||
    type === 'account_restriction' ||
    type === 'moderation_flagged' ||
    type === 'verification_updated' ||
    type.startsWith('escrow_')
  ) {
    return 'high';
  }
  if (
    type === 'message' ||
    type.startsWith('offer_') ||
    type === 'mutual_agreement' ||
    type === 'completion_release' ||
    type === 'premium_activated'
  ) {
    return 'medium';
  }
  return 'low';
}

export const FILTER_LABELS: Record<NotificationFilterTab, string> = {
  all: 'All',
  activity: 'Activity',
  payments: 'Payments',
  system: 'System',
};
