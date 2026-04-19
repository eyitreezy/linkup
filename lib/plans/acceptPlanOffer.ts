import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlan, DbPlanOffer } from '@/types/database';

export type AcceptPlanOfferResult = { error: string | null; escrowId?: string };

/**
 * Host accepts one offer: supersede others, set plan status, create escrow if paid.
 */
export async function acceptPlanOffer(
  client: SupabaseClient,
  params: {
    planId: string;
    offer: DbPlanOffer;
    plan: DbPlan;
    currentUserId: string;
  }
): Promise<AcceptPlanOfferResult> {
  const { planId, offer, plan, currentUserId } = params;
  if (plan.creator_id !== currentUserId) {
    return { error: 'Only the plan host can accept an offer.' };
  }
  if (offer.status !== 'pending' && offer.status !== 'countered') {
    return { error: 'This offer can no longer be accepted.' };
  }

  const { error: e1 } = await client.from('plan_offers').update({ status: 'accepted' }).eq('id', offer.id);
  if (e1) return { error: e1.message };

  await client.from('plan_offers').update({ status: 'superseded' }).eq('plan_id', planId).neq('id', offer.id);

  const agreedAmount = offer.amount_cents ?? plan.starting_price_cents ?? 0;
  const mergedSchedule = offer.proposed_scheduled_at ?? plan.scheduled_at;
  const agreedAt = mergedSchedule ? new Date(mergedSchedule).toISOString() : null;

  const { error: e2 } = await client
    .from('plans')
    .update({
      status: 'agreed',
      accepted_offer_id: offer.id,
      agreed_price_cents: agreedAmount > 0 ? agreedAmount : null,
      agreed_scheduled_at: agreedAt,
      agreed_location: plan.location_label ?? null,
      agreed_notes: offer.message ?? null,
      ...(mergedSchedule ? { scheduled_at: mergedSchedule } : {}),
    })
    .eq('id', planId);
  if (e2) return { error: e2.message };

  /** Escrow is created on PL6a “Proceed to secure payment”, not at accept. */
  return { error: null };
}
