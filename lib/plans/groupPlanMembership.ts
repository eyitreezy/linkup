/**
 * Group plan guest membership and capacity — single client-side source for action gating.
 * Server RPCs enforce the same rules; keep in sync with membership migrations.
 */
import type { PlanGuestEscrowSnapshot } from '@/lib/plans/planPayShare';
import type { PlanLockState } from '@/lib/plans/planViewerContext';
import { findMyLatestOffer } from '@/lib/plans/planViewerContext';
import { isOfferLive } from '@/lib/plans/negotiationState';
import type { DbPlan, DbPlanOffer, JoinRequestStatus } from '@/types/database';

export type GroupGuestMembershipStatus =
  | 'none'
  | 'pending_request'
  | 'pending_offer'
  | 'confirmed_guest'
  | 'declined'
  | 'opted_out';

const TERMINAL_ESCROW = new Set(['cancelled', 'refunded']);

export function resolveGroupGuestMembership(
  userId: string | undefined,
  offers: DbPlanOffer[],
  opts?: {
    myJoinRequest?: { status: JoinRequestStatus } | null;
    myGuestEscrow?: PlanGuestEscrowSnapshot | null;
    hasOptedOut?: boolean;
    invitationAccepted?: boolean;
  }
): GroupGuestMembershipStatus {
  if (!userId) return 'none';
  if (opts?.hasOptedOut) return 'opted_out';

  const myOffer = findMyLatestOffer(offers, userId);
  if (myOffer?.status === 'accepted') return 'confirmed_guest';
  if (myOffer?.status === 'opted_out') return 'opted_out';

  if (opts?.myJoinRequest?.status === 'approved') return 'confirmed_guest';
  if (opts?.myJoinRequest?.status === 'pending') return 'pending_request';
  if (opts?.myJoinRequest?.status === 'declined') return 'declined';

  if (opts?.invitationAccepted) return 'confirmed_guest';

  const escrow = opts?.myGuestEscrow;
  if (
    escrow?.guest_id === userId &&
    escrow.status != null &&
    !TERMINAL_ESCROW.has(escrow.status)
  ) {
    return 'confirmed_guest';
  }

  if (myOffer && isOfferLive(myOffer)) return 'pending_offer';

  return 'none';
}

export function isConfirmedGroupGuest(status: GroupGuestMembershipStatus): boolean {
  return status === 'confirmed_guest';
}

/** Host may open the group cancellation flow. */
export function canHostCancelGroupPlan(
  plan: Pick<DbPlan, 'is_group_plan' | 'status' | 'creator_id'>,
  hostUserId: string | undefined
): boolean {
  if (!hostUserId || plan.creator_id !== hostUserId || !plan.is_group_plan) return false;
  if (plan.status === 'cancelled' || plan.status === 'completed' || plan.status === 'draft') {
    return false;
  }
  return true;
}

/** Guest may opt out (>48h before meetup, confirmed member). */
export function canGuestOptOutOfGroupPlan(
  plan: Pick<DbPlan, 'is_group_plan' | 'status' | 'scheduled_at' | 'agreed_scheduled_at'>,
  membership: GroupGuestMembershipStatus,
  opts?: { hasOptedOut?: boolean; hoursUntilMeetup?: number }
): { allowed: boolean; reason?: string } {
  if (!plan.is_group_plan) return { allowed: false, reason: 'not_a_group_plan' };
  if (plan.status === 'cancelled') return { allowed: false, reason: 'plan_cancelled' };
  if (opts?.hasOptedOut) return { allowed: false, reason: 'already_opted_out' };
  if (!isConfirmedGroupGuest(membership)) {
    return { allowed: false, reason: 'not_a_participant' };
  }

  const hours =
    opts?.hoursUntilMeetup ??
    (() => {
      const iso = plan.agreed_scheduled_at ?? plan.scheduled_at;
      if (!iso) return -1;
      return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60);
    })();

  if (hours >= 0 && hours < 48) {
    return { allowed: false, reason: 'opt_out_window_closed' };
  }

  return { allowed: true };
}

export type GuestParticipationGate = {
  canRequest: boolean;
  canOffer: boolean;
  blockReason: 'already_guest' | 'group_filled' | 'plan_closed' | null;
  membership: GroupGuestMembershipStatus;
};

/**
 * Whether a browsing guest may open request/offer flows.
 * Uses RPC-backed available slots when provided; falls back to lock state.
 */
export function resolveGuestParticipationGate(
  plan: Pick<DbPlan, 'is_group_plan' | 'is_negotiable' | 'status' | 'group_closed_at'>,
  membership: GroupGuestMembershipStatus,
  lockState: PlanLockState,
  opts?: {
    planExpired?: boolean;
    availableSlots?: number | null;
  }
): GuestParticipationGate {
  const base: GuestParticipationGate = {
    canRequest: false,
    canOffer: false,
    blockReason: null,
    membership,
  };

  if (opts?.planExpired || plan.status === 'cancelled' || plan.group_closed_at) {
    return { ...base, blockReason: 'plan_closed' };
  }

  if (isConfirmedGroupGuest(membership)) {
    return { ...base, blockReason: 'already_guest' };
  }

  if (membership === 'pending_request' || membership === 'pending_offer') {
    return base;
  }

  const slotsKnown = opts?.availableSlots != null && plan.is_group_plan;
  const groupFull = slotsKnown
    ? (opts!.availableSlots as number) <= 0
    : lockState === 'full';

  if (groupFull && plan.is_group_plan) {
    return { ...base, blockReason: 'group_filled' };
  }

  const hasCapacity = lockState === 'open' || (plan.is_group_plan && lockState === 'partial');

  return {
    ...base,
    canRequest: hasCapacity && plan.is_negotiable === false,
    canOffer: hasCapacity && plan.is_negotiable !== false,
    blockReason: null,
  };
}

export const GUEST_MEMBERSHIP_STATUS_COPY: Record<
  Exclude<GroupGuestMembershipStatus, 'none' | 'opted_out'>,
  string
> = {
  confirmed_guest: 'You are already a guest on this plan.',
  pending_request: 'Your join request is pending host review.',
  pending_offer: 'You already have an active offer on this plan.',
  declined: 'Your request was not approved.',
};
