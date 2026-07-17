import type { NotificationEventType } from '@/types/database';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IonName = ComponentProps<typeof Ionicons>['name'];

export function notificationIcon(type: string): IonName {
  const t = type as NotificationEventType;
  switch (t) {
    case 'offer_new':
    case 'offer_received':
      return 'pricetag-outline';
    case 'offer_counter':
    case 'offer_countered':
      return 'swap-horizontal-outline';
    case 'offer_accepted':
      return 'checkmark-circle-outline';
    case 'offer_declined':
      return 'close-circle-outline';
    case 'mutual_agreement':
      return 'hand-left-outline';
    case 'premium_activated':
      return 'sparkles-outline';
    case 'escrow_funded':
    case 'escrow_status':
      return 'wallet';
    case 'plan_reminder':
    case 'payment_reminder':
      return 'alarm-outline';
    case 'completion_release':
      return 'checkmark-done-outline';
    case 'credit_issued':
    case 'credit_expiring':
      return 'sparkles-outline';
    case 'trial_started':
      return 'sparkles-outline';
    case 'trial_expiring':
    case 'trial_expired':
      return 'time-outline';
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
    case 'meet_type_submitted':
      return 'layers-outline';
    case 'meet_type_approved':
      return 'checkmark-circle-outline';
    case 'meet_type_rejected':
      return 'close-circle-outline';
    case 'slot_accepted_fund_now':
      return 'wallet-outline';
    case 'group_closed':
      return 'lock-closed-outline';
    case 'join_request_received':
      return 'person-add-outline';
    case 'join_request_approved':
      return 'checkmark-circle-outline';
    case 'join_request_declined':
      return 'close-circle-outline';
    case 'plan_invitation_received':
      return 'mail-outline';
    case 'plan_invitation_accepted':
      return 'checkmark-circle-outline';
    case 'plan_invitation_declined':
      return 'close-circle-outline';
    case 'plan_invitation_expired':
      return 'time-outline';
    default:
      return 'notifications-outline';
  }
}
