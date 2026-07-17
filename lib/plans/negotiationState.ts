import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlan, DbPlanOffer } from '@/types/database';

const RESOLVED_STATUSES = new Set([
  'accepted',
  'declined',
  'withdrawn',
  'superseded',
  'expired',
]);

const LIVE_STATUSES = new Set([
  'pending',
  'countered',
  'countered_by_host',
  'countered_by_guest',
]);

/** Offer statuses still in active negotiation (carousel / dashboards). */
export const LIVE_NEGOTIATION_OFFER_STATUSES = [
  'pending',
  'countered',
  'countered_by_host',
  'countered_by_guest',
] as const;

export function offerLiveAmount(offer: Pick<DbPlanOffer, 'amount_cents' | 'current_amount_cents'>): number | null {
  return offer.current_amount_cents ?? offer.amount_cents;
}

export function isOfferLive(offer: Pick<DbPlanOffer, 'status' | 'expires_at'>): boolean {
  if (RESOLVED_STATUSES.has(offer.status)) return false;
  if (LIVE_STATUSES.has(offer.status)) return !isOfferExpired(offer);
  return false;
}

function effectiveAwaiting(
  offer: Pick<DbPlanOffer, 'status' | 'awaiting_response_from'>
): 'host' | 'guest' | null {
  if (offer.awaiting_response_from) return offer.awaiting_response_from;
  if (offer.status === 'pending' || offer.status === 'countered_by_guest') return 'host';
  if (offer.status === 'countered' || offer.status === 'countered_by_host') return 'guest';
  return null;
}

export function deriveNegotiationContext(
  offer: DbPlanOffer,
  plan: DbPlan,
  userId: string | undefined
) {
  const isHost = plan.creator_id === userId;
  const isGuest = offer.bidder_id === userId;
  const awaiting = effectiveAwaiting(offer);
  const isMyTurn =
    awaiting != null && awaiting === (isHost ? 'host' : 'guest');
  const isOthersTurn = awaiting != null && !isMyTurn;
  const isLive = isOfferLive(offer);
  const canWithdraw =
    isLive &&
    isGuest &&
    !isMyTurn &&
    awaiting === 'host' &&
    (offer.status === 'pending' || offer.status === 'countered_by_guest');

  return { isHost, isGuest, isMyTurn, isOthersTurn, isLive, canWithdraw };
}

export const OFFER_ACTION_LABELS: Record<string, string> = {
  offer: 'Offered',
  counter: 'Countered with',
  accept: 'Accepted',
  decline: 'Declined',
  withdraw: 'Withdrew offer',
};

export function offerStatusLabel(offer: DbPlanOffer): string {
  if (isOfferExpired(offer) && offer.status === 'pending') return 'Expired';
  switch (offer.status) {
    case 'countered_by_host':
      return 'Host countered';
    case 'countered_by_guest':
      return 'Guest countered';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return offer.status;
  }
}
