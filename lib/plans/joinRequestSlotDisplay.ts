import type { DbPlan } from '@/types/database';
import { formatGroupSplitCents } from '@/lib/plans/groupSplitDynamic';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';

/** Display label for the formula slot price on non-negotiable plans. */
export function resolveJoinRequestSlotCentsLabel(plan: DbPlan): string {
  const currency = plan.currency ?? 'NGN';

  if (plan.escrow_pattern === 'C') {
    const cents = plan.starting_price_cents ?? 0;
    return formatEscrowMoney(cents, currency);
  }

  if (plan.escrow_pattern === 'B') {
    if (plan.is_group_plan) {
      const cents = plan.current_suggested_share_cents ?? 0;
      if (cents > 0) return formatGroupSplitCents(cents, currency);
    } else {
      const total = plan.starting_price_cents ?? 0;
      const bps = plan.host_contribution_bps ?? 5000;
      const guestCents = Math.max(0, total - Math.floor((total * bps) / 10000));
      return formatEscrowMoney(guestCents, currency);
    }
  }

  return '';
}

export function resolveJoinRequestSlotCents(plan: DbPlan): number {
  if (plan.escrow_pattern === 'C') {
    return Math.max(0, plan.starting_price_cents ?? 0);
  }
  if (plan.escrow_pattern === 'B') {
    if (plan.is_group_plan) {
      return Math.max(0, plan.current_suggested_share_cents ?? 0);
    }
    const total = plan.starting_price_cents ?? 0;
    const bps = plan.host_contribution_bps ?? 5000;
    return Math.max(0, total - Math.floor((total * bps) / 10000));
  }
  return 0;
}
