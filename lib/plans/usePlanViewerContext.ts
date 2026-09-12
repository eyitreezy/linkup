import { derivePlanViewerContext, type PlanViewerContext } from '@/lib/plans/planViewerContext';
import type { PlanGuestEscrowSnapshot } from '@/lib/plans/planPayShare';
import type { DbPlan, DbPlanOffer, JoinRequestStatus } from '@/types/database';
import { useMemo } from 'react';

export type { PlanViewerContext, PlanLockState, AcceptedGuestRef } from '@/lib/plans/planViewerContext';
export {
  derivePlanViewerContext,
  findMyLatestOffer,
  listAcceptedGuests,
  acceptedGuestCount,
  computePlanLockState,
} from '@/lib/plans/planViewerContext';

export function usePlanViewerContext(
  plan: DbPlan | null,
  currentUserId: string | undefined,
  offers: DbPlanOffer[],
  opts?: {
    planExpired?: boolean;
    /** @deprecated pass planExpired */
    moodClosed?: boolean;
    completionSelfAcked?: boolean;
    myJoinRequest?: { id: string; status: JoinRequestStatus } | null;
    myGuestEscrow?: PlanGuestEscrowSnapshot | null;
    hasOptedOut?: boolean;
    invitationAccepted?: boolean;
    availableSlots?: number | null;
  }
): PlanViewerContext | null {
  return useMemo(() => {
    if (!plan) return null;
    return derivePlanViewerContext(plan, currentUserId, offers, opts);
  }, [
    plan,
    currentUserId,
    offers,
    opts?.planExpired,
    opts?.moodClosed,
    opts?.completionSelfAcked,
    opts?.myJoinRequest,
    opts?.myGuestEscrow,
    opts?.hasOptedOut,
    opts?.invitationAccepted,
    opts?.availableSlots,
  ]);
}
