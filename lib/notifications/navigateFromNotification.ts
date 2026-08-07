import { planNegotiateHref } from '@/lib/plans/negotiateRoute';
import { warmPlanDetailNavigation } from '@/lib/plans/planDetailSeed';
import type { NotificationPayload } from '@/types/database';
import type { Href } from 'expo-router';

type Nav = { push: (href: Href) => void };

function warmPlanFromPayload(data: NotificationPayload | null | undefined) {
  if (data && typeof data === 'object' && typeof data.planId === 'string' && data.planId) {
    warmPlanDetailNavigation(data.planId);
  }
}

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
    if (data.href === '/discover') {
      return '/(tabs)' as Href;
    }
    if (
      data.href.includes('/negotiate') &&
      typeof data.offerId === 'string' &&
      data.offerId.trim() &&
      !data.href.includes('offerId=')
    ) {
      const sep = data.href.includes('?') ? '&' : '?';
      return `${data.href}${sep}offerId=${encodeURIComponent(data.offerId)}` as Href;
    }
    return data.href as Href;
  }
  if (typeof data.ticketId === 'string' && data.ticketId.length > 0) {
    return `/support/ticket/${data.ticketId}` as Href;
  }
  if (data.chatId) return `/chat/${data.chatId}` as Href;
  if (data.escrowId) return `/escrow/${data.escrowId}` as Href;
  if (data.planId) {
    if (typeof data.offerId === 'string' && data.offerId.trim()) {
      return planNegotiateHref(data.planId, { offerId: data.offerId });
    }
    return `/plan/${data.planId}` as Href;
  }
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
    warmPlanFromPayload(data);
    router.push(href);
    return;
  }
  const t = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (t === 'offer_received' || t === 'offer_countered') {
    if (data?.planId) {
      warmPlanFromPayload(data);
      router.push(
        planNegotiateHref(data.planId, {
          offerId: typeof data.offerId === 'string' ? data.offerId : undefined,
          action: t === 'offer_countered' ? 'counter' : undefined,
        })
      );
      return;
    }
  }
  if (t === 'offer_accepted' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/agreement` as Href);
    return;
  }
  if (t === 'offer_declined' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}` as Href);
    return;
  }
  if (t === 'slot_accepted_fund_now' && data?.planId) {
    warmPlanFromPayload(data);
    const offerQ =
      typeof data.offerId === 'string' && data.offerId.trim()
        ? (`?offerId=${encodeURIComponent(data.offerId)}` as const)
        : '';
    router.push(`/plan/${data.planId}/agreement${offerQ}` as Href);
    return;
  }
  if (t === 'group_closed' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/agreement` as Href);
    return;
  }
  if (t === 'join_request_received' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/requests` as Href);
    return;
  }
  if (t === 'join_request_approved') {
    if (data?.escrowId) {
      router.push(`/escrow/${data.escrowId}` as Href);
      return;
    }
    if (data?.planId) {
      warmPlanFromPayload(data);
      router.push(`/plan/${data.planId}/agreement` as Href);
      return;
    }
  }
  if (t === 'join_request_declined') {
    router.push('/(tabs)' as Href);
    return;
  }
  if (t === 'mood_plan_nearby') {
    if (data?.planId) warmPlanFromPayload(data);
    router.push('/(tabs)' as Href);
    return;
  }
  if (t === 'plan_invitation_received' && data?.planId && data?.invitationId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/invitation/${data.invitationId}` as Href);
    return;
  }
  if (
    (t === 'plan_invitation_accepted' ||
      t === 'plan_invitation_declined' ||
      t === 'plan_invitation_expired') &&
    data?.planId
  ) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/requests` as Href);
    return;
  }
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
  if (t === 'meetup_confirm_requested' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/confirm` as Href);
    return;
  }
  if (
    (t === 'meetup_confirm_request' ||
      t === 'meetup_confirm_12h' ||
      t === 'meetup_confirm_23h' ||
      t === 'meetup_confirm_t0') &&
    data?.planId
  ) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/confirm` as Href);
    return;
  }
  if (t === 'partner_arrived' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}` as Href);
    return;
  }
  if (t === 'live_location_started' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}` as Href);
    return;
  }
  if (
    (t === 'group_countdown_7day' ||
      t === 'group_countdown_48h' ||
      t === 'group_countdown_24h' ||
      t === 'group_countdown_6h' ||
      t === 'group_countdown_1h' ||
      t === 'group_meetup_started') &&
    data?.planId
  ) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}` as Href);
    return;
  }
  if (t === 'group_minimum_not_met' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/minimum-action` as Href);
    return;
  }
  if (
    (t === 'group_plan_cancelled_minimum' || t === 'group_plan_host_cancelled') &&
    data?.planId
  ) {
    router.push('/wallet' as Href);
    return;
  }
  if (t === 'group_member_opted_out' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}` as Href);
    return;
  }
  if (t === 'review_request' && data?.planId) {
    warmPlanFromPayload(data);
    router.push(`/plan/${data.planId}/review` as Href);
    return;
  }
  if (
    t === 'exigency_auto_triggered' ||
    t === 'exigency_submitted' ||
    t === 'exigency_outcome_applied'
  ) {
    router.push('/wallet' as Href);
    return;
  }
  if (t === 'meetup_auto_confirmed') {
    router.push('/wallet' as Href);
    return;
  }
  if (
    t === 'disbursement_reminder' ||
    t === 'disbursement_reminder_urgent' ||
    t === 'disbursement_final_warning' ||
    t === 'disbursement_escalated' ||
    t === 'withdrawal_initiated' ||
    t === 'withdrawal_completed' ||
    t === 'withdrawal_failed'
  ) {
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
