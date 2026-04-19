import type { DbPlanOffer } from '@/types/database';

/** Max offer rounds (new rows) per plan — client enforcement; aligns with product spec. */
export const MAX_OFFERS_PER_PLAN = 5;

export const OFFER_TTL_MS = 24 * 60 * 60 * 1000;

export function offerCountsTowardLimit(o: Pick<DbPlanOffer, 'status'>): boolean {
  return o.status === 'pending' || o.status === 'countered';
}

export function isOfferExpired(offer: Pick<DbPlanOffer, 'status' | 'expires_at'>): boolean {
  if (offer.status === 'expired') return true;
  if (offer.status !== 'pending' && offer.status !== 'countered') return false;
  if (!offer.expires_at) return false;
  return new Date(offer.expires_at).getTime() < Date.now();
}

export function countOffersTowardLimit(offers: DbPlanOffer[]): number {
  return offers.filter((o) => offerCountsTowardLimit(o) && !isOfferExpired(o)).length;
}

export function nextOfferRound(offers: DbPlanOffer[]): number {
  if (offers.length === 0) return 1;
  return Math.max(...offers.map((o) => o.round), 0) + 1;
}
