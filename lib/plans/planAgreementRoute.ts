import type { Href } from 'expo-router';
import type { DbPlan, DbPlanOffer } from '@/types/database';

/** Plan has moved past open negotiation (1:1 or group slot agreed). */
export function planIsPastNegotiation(status: string): boolean {
  return (
    status === 'agreed' ||
    status === 'awaiting_payment' ||
    status === 'active' ||
    status === 'completed'
  );
}

type PlanSlice = Pick<DbPlan, 'id' | 'is_group_plan' | 'accepted_offer_id'>;

/** Resolve the accepted offer id to pass into the agreement screen (1:1 host/guest + group slots). */
export function resolveAgreementOfferId(
  plan: Pick<DbPlan, 'accepted_offer_id'>,
  userId: string | undefined,
  offers: DbPlanOffer[],
  explicitOfferId?: string | null
): string | undefined {
  if (explicitOfferId) return explicitOfferId;
  if (userId) {
    const userAccepted = offers.find((o) => o.bidder_id === userId && o.status === 'accepted');
    if (userAccepted) return userAccepted.id;
  }
  if (plan.accepted_offer_id) {
    const matched = offers.find((o) => o.id === plan.accepted_offer_id && o.status === 'accepted');
    if (matched) return plan.accepted_offer_id;
    if (offers.length === 0) return plan.accepted_offer_id;
  }
  return offers.find((o) => o.status === 'accepted')?.id;
}

export function resolvePlanAgreementHref(
  plan: PlanSlice,
  opts?: { offerId?: string | null; userId?: string | null; offers?: DbPlanOffer[] }
): Href {
  const planId = plan.id;
  const slotId = resolveAgreementOfferId(plan, opts?.userId, opts?.offers ?? [], opts?.offerId);
  if (slotId) return `/plan/${planId}/agreement?offerId=${slotId}` as Href;
  return `/plan/${planId}/agreement` as Href;
}

/** Whether the current user should leave negotiate for the agreement screen. */
export function shouldRedirectFromNegotiate(
  plan: Pick<DbPlan, 'id' | 'status' | 'is_group_plan' | 'accepted_offer_id' | 'creator_id'>,
  userId: string | undefined,
  offers: DbPlanOffer[]
): { redirect: boolean; href: Href } {
  if (!userId) return { redirect: false, href: '/plan' as Href };

  const userAccepted = offers.find((o) => o.bidder_id === userId && o.status === 'accepted');
  if (plan.is_group_plan && userAccepted) {
    return {
      redirect: true,
      href: resolvePlanAgreementHref(plan, { offerId: userAccepted.id }),
    };
  }

  if (!plan.is_group_plan) {
    const oneToOneAgreed =
      planIsPastNegotiation(plan.status) ||
      (!!plan.accepted_offer_id &&
        offers.some((o) => o.id === plan.accepted_offer_id && o.status === 'accepted'));

    if (oneToOneAgreed) {
      const isParty =
        plan.creator_id === userId ||
        !!userAccepted ||
        offers.some((o) => o.id === plan.accepted_offer_id && o.bidder_id === userId);
      if (isParty) {
        return {
          redirect: true,
          href: resolvePlanAgreementHref(plan, { userId, offers }),
        };
      }
    }
  }

  return { redirect: false, href: '/plan' as Href };
}
