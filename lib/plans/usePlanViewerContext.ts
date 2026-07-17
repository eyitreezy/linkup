import { derivePlanViewerContext, type PlanViewerContext } from '@/lib/plans/planViewerContext';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { useMemo } from 'react';

export type { PlanViewerContext, PlanLockState, AcceptedGuestRef } from '@/lib/plans/planViewerContext';
export {
  derivePlanViewerContext,
  findMyLatestOffer,
  listAcceptedGuests,
  acceptedGuestCount,
  computePlanLockState,
} from '@/lib/plans/planViewerContext';

import type { JoinRequestStatus } from '@/types/database';

export function usePlanViewerContext(
  plan: DbPlan | null,
  currentUserId: string | undefined,
  offers: DbPlanOffer[],
  opts?: {
    moodClosed?: boolean;
    completionSelfAcked?: boolean;
    myJoinRequest?: { id: string; status: JoinRequestStatus } | null;
  }
): PlanViewerContext | null {
  return useMemo(() => {
    if (!plan) return null;
    return derivePlanViewerContext(plan, currentUserId, offers, opts);
  }, [plan, currentUserId, offers, opts?.moodClosed, opts?.completionSelfAcked, opts?.myJoinRequest]);
}
