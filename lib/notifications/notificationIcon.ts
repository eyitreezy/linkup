import type { NotificationEventType } from '@/types/database';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IonName = ComponentProps<typeof Ionicons>['name'];

export function notificationIcon(type: string): IonName {
  const t = type as NotificationEventType;
  switch (t) {
    case 'offer_new':
    case 'offer_counter':
      return 'pricetag-outline';
    case 'mutual_agreement':
      return 'hand-left-outline';
    case 'premium_activated':
      return 'sparkles-outline';
    case 'escrow_funded':
    case 'escrow_status':
      return 'wallet-outline';
    case 'plan_reminder':
      return 'alarm-outline';
    case 'completion_release':
      return 'checkmark-done-outline';
    case 'cancel_chargeback':
      return 'close-circle-outline';
    case 'message':
      return 'chatbubble-outline';
    case 'report_submitted':
      return 'flag-outline';
    case 'dispute_opened':
      return 'warning-outline';
    case 'kyc_submitted':
    case 'kyc_decision':
      return 'shield-checkmark-outline';
    case 'account_restriction':
      return 'lock-closed-outline';
    default:
      return 'notifications-outline';
  }
}
