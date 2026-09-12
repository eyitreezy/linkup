import type { PlanViewerContext } from '@/lib/plans/planViewerContext';
import type { JoinRequestStatus } from '@/types/database';

export type GuestJoinRequestCardPhase =
  | 'can_request'
  | 'pending'
  | 'approved_pay'
  | 'approved_done'
  | 'declined'
  | 'closed'
  | 'already_guest'
  | 'group_filled';

export function deriveGuestJoinRequestCardPhase(
  ctx: Pick<
    PlanViewerContext,
    | 'showRequestToJoin'
    | 'showViewRequest'
    | 'showPayShare'
    | 'payShareEscrowId'
    | 'guestParticipationBlockReason'
    | 'guestMembership'
  >,
  myJoinRequest: { status: JoinRequestStatus } | null | undefined
): GuestJoinRequestCardPhase {
  if (ctx.guestParticipationBlockReason === 'already_guest') return 'already_guest';
  if (ctx.guestParticipationBlockReason === 'group_filled') return 'group_filled';
  if (ctx.showPayShare && ctx.payShareEscrowId) return 'approved_pay';
  if (myJoinRequest?.status === 'approved') return 'approved_done';
  if (myJoinRequest?.status === 'declined') return 'declined';
  if (myJoinRequest?.status === 'pending' || ctx.showViewRequest) return 'pending';
  if (ctx.showRequestToJoin) return 'can_request';
  if (ctx.guestParticipationBlockReason === 'plan_closed') return 'closed';
  return 'closed';
}

export const GUEST_JOIN_REQUEST_PENDING_COPY = {
  title: 'Request pending',
  message:
    'Your join request is waiting for the host to review. You will be notified when they respond.',
} as const;
