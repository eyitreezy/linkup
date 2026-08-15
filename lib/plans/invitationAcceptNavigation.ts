import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { planNegotiateHref } from '@/lib/plans/negotiateRoute';

export type InvitationAcceptResult = {
  isNegotiable: boolean;
  offerId?: string;
  escrowId?: string;
};

export function navigateAfterInvitationAccept(planId: string, result: InvitationAcceptResult) {
  if (result.isNegotiable && result.offerId) {
    router.replace(planNegotiateHref(planId, { offerId: result.offerId }));
    return;
  }
  if (result.escrowId) {
    router.replace(`/escrow/${result.escrowId}` as Href);
    return;
  }
  router.replace(`/plan/${planId}/agreement` as Href);
}
