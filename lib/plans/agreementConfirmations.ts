import type { DbPlan, DbPlanOffer } from '@/types/database';

/** Host + accepted guest for this agreement (1:1 or group slot). */
export function agreementPartyUserIds(plan: DbPlan, offer: DbPlanOffer): string[] {
  return [plan.creator_id, offer.bidder_id];
}

export function bothAgreementPartiesConfirmed(
  confirmationUserIds: string[],
  plan: DbPlan,
  offer: DbPlanOffer
): boolean {
  const confirmed = new Set(confirmationUserIds);
  return agreementPartyUserIds(plan, offer).every((id) => confirmed.has(id));
}
