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
    case 'meetup_confirm_requested':
    case 'meetup_confirm_request':
    case 'meetup_confirm_12h':
    case 'meetup_confirm_23h':
    case 'meetup_confirm_t0':
      return 'people-outline';
    case 'partner_arrived':
    case 'live_location_started':
      return 'location-outline';
    case 'group_countdown_7day':
    case 'group_countdown_48h':
    case 'group_countdown_24h':
    case 'group_countdown_6h':
    case 'group_countdown_1h':
    case 'group_meetup_started':
      return 'timer-outline';
    case 'group_minimum_not_met':
      return 'people-outline';
    case 'group_plan_cancelled_minimum':
    case 'group_plan_host_cancelled':
      return 'wallet-outline';
    case 'group_member_opted_out':
      return 'person-remove-outline';
    case 'review_request':
      return 'star-outline';
    case 'exigency_auto_triggered':
    case 'exigency_submitted':
    case 'exigency_outcome_applied':
      return 'document-text-outline';
    case 'meetup_auto_confirmed':
      return 'checkmark-circle-outline';
    case 'disbursement_reminder':
      return 'wallet-outline';
    case 'disbursement_reminder_urgent':
      return 'time-outline';
    case 'disbursement_final_warning':
      return 'warning-outline';
    case 'disbursement_escalated':
      return 'alert-circle-outline';
    case 'withdrawal_initiated':
      return 'arrow-down-circle-outline';
    case 'withdrawal_completed':
      return 'checkmark-done-outline';
    case 'withdrawal_failed':
      return 'close-circle-outline';
    case 'mood_plan_nearby':
      return 'flash-outline';
    default:
      return 'notifications-outline';
  }
}
