import type { DbPlanOffer } from '@/types/database';

const offersByPlanId = new Map<string, DbPlanOffer[]>();

export function seedPlanDetailOffers(planId: string, offers: DbPlanOffer[]): void {
  offersByPlanId.set(planId, offers);
}

export function peekPlanDetailOffersSeed(planId: string): DbPlanOffer[] | null {
  return offersByPlanId.get(planId) ?? null;
}

export function clearPlanDetailOffersSeed(planId: string): void {
  offersByPlanId.delete(planId);
}
