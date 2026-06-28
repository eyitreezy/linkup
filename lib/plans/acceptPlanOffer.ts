import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlan, DbPlanOffer } from '@/types/database';

export type AcceptPlanOfferResult = { error: string | null; escrowId?: string; offerId?: string };

/**
 * Host accepts one offer: supersede others (1:1), set plan status, create escrow if paid.
 * Group plans: accept a slot without closing the plan or superseding other pending offers.
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

  if (plan.is_group_plan) {
    const maxGuests = plan.max_guests ?? 999;
    const currentCount = plan.accepted_guest_count ?? 0;
    if (currentCount >= maxGuests) {
      return { error: 'This group is full.' };
    }

    const { data: existingSlot } = await client
      .from('plan_offers')
      .select('id')
      .eq('plan_id', planId)
      .eq('bidder_id', offer.bidder_id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (existingSlot?.id) {
      return { error: 'This guest already has an accepted slot.' };
    }
  }

  const { error: e1 } = await client.from('plan_offers').update({ status: 'accepted' }).eq('id', offer.id);
  if (e1) return { error: e1.message };

  if (plan.is_group_plan) {
    const newCount = (plan.accepted_guest_count ?? 0) + 1;
    const { error: e2 } = await client
      .from('plans')
      .update({
        status: 'negotiating',
        accepted_guest_count: newCount,
      })
      .eq('id', planId);
    if (e2) return { error: e2.message };
    return { error: null, offerId: offer.id };
  }

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
  return { error: null, offerId: offer.id };
}
