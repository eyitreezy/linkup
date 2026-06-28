import type { EscrowRoleSplit } from '@/lib/plans/escrowParties';
import type { DbPlan } from '@/types/database';

type GroupSplitPlan = Pick<DbPlan, 'creator_id' | 'max_guests' | 'accepted_guest_count' | 'escrow_pattern'>;

/** Host + max guest capacity (equal split divides total among all slots). */
export function groupPlanParticipantCount(plan: Pick<DbPlan, 'max_guests' | 'accepted_guest_count'>): number {
  const guestSlots = Math.max(1, plan.max_guests ?? 1);
  return guestSlots + 1;
}

/** Equal per-person share; host absorbs rounding remainder via ceil. */
export function groupPlanPerPersonCents(totalCents: number, participantCount: number): number {
  return Math.ceil(totalCents / Math.max(1, participantCount));
}

export function isGroupEqualSplitPlan(plan: Pick<DbPlan, 'is_group_plan' | 'escrow_pattern'>): boolean {
  return !!plan.is_group_plan && plan.escrow_pattern === 'B';
}

/**
 * Group plan + pattern B: total commitment split equally among host and all guest slots.
 * Host funds their share once (on the first escrow row that still needs it).
 */
export function resolveGroupSplitEscrowParties(
  plan: GroupSplitPlan,
  guestUserId: string,
  totalCents: number,
  hostShareAlreadyFunded: boolean
): EscrowRoleSplit {
  const participants = groupPlanParticipantCount(plan);
  const perPerson = groupPlanPerPersonCents(totalCents, participants);
  const hostId = plan.creator_id;

  return {
    payerId: hostId,
    payeeId: guestUserId,
    hostShareCents: hostShareAlreadyFunded ? 0 : perPerson,
    guestShareCents: perPerson,
  };
}
