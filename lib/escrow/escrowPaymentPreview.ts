import { resolveEscrowParties } from '@/lib/plans/escrowParties';
import {
  groupPlanParticipantCount,
  groupPlanPerPersonCents,
  isGroupEqualSplitPlan,
} from '@/lib/plans/groupEscrowSplit';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import type { DbPlan, EscrowPattern } from '@/types/database';

export function formatEscrowMoney(cents: number, currency: string): string {
  if (currency === 'NGN') {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(cents) / 100);
  }
  return `${currency} ${Math.round(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function isMeetupWithinHours(iso: string | null | undefined, withinHours: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const ms = t - Date.now();
  return ms > 0 && ms <= withinHours * 60 * 60 * 1000;
}

export function meetupHoursUntilLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const hours = Math.round((t - Date.now()) / (60 * 60 * 1000));
  if (hours <= 0) return null;
  if (hours < 24) return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in about ${days} day${days === 1 ? '' : 's'}`;
}

export type AgreementPaymentPreview = {
  pattern: EscrowPattern;
  totalCents: number;
  userPaysCents: number;
  counterpartyPaysCents: number;
  userIsPayer: boolean;
  currency: string;
};

export function getAgreementPaymentPreview(
  plan: Pick<
    DbPlan,
    'creator_id' | 'escrow_pattern' | 'host_contribution_bps' | 'currency' | 'is_group_plan' | 'max_guests' | 'accepted_guest_count'
  >,
  guestUserId: string,
  totalCents: number,
  currentUserId: string
): AgreementPaymentPreview {
  const pattern = (plan.escrow_pattern ?? 'A') as EscrowPattern;

  if (isGroupEqualSplitPlan(plan)) {
    const perPerson = groupPlanPerPersonCents(totalCents, groupPlanParticipantCount(plan));
    return {
      pattern,
      totalCents,
      userPaysCents: grossAmountCents(perPerson),
      counterpartyPaysCents: grossAmountCents(Math.max(0, totalCents - perPerson)),
      userIsPayer: true,
      currency: plan.currency ?? 'NGN',
    };
  }

  const { payerId, hostShareCents, guestShareCents } = resolveEscrowParties(plan, guestUserId, totalCents);
  const userIsHost = currentUserId === plan.creator_id;
  const userPaysBudget =
    pattern === 'B'
      ? userIsHost
        ? hostShareCents
        : guestShareCents
      : payerId === currentUserId
        ? totalCents
        : 0;
  const counterpartyPaysBudget = totalCents - userPaysBudget;
  return {
    pattern,
    totalCents,
    userPaysCents: grossAmountCents(userPaysBudget),
    counterpartyPaysCents: grossAmountCents(counterpartyPaysBudget),
    userIsPayer: userPaysBudget > 0,
    currency: plan.currency ?? 'NGN',
  };
}

export function patternLabel(pattern: EscrowPattern): string {
  switch (pattern) {
    case 'A':
      return 'Host funds';
    case 'B':
      return 'Split escrow';
    case 'C':
      return 'Guest funds';
    default:
      return 'Secure escrow';
  }
}
