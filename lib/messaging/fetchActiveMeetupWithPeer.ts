/**
 * Find a plan/meetup shared with a chat peer (host + accepted bidder).
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const LINK_STATUSES = ['negotiating', 'agreed', 'awaiting_payment', 'active', 'completed'] as const;

export type LinkedMeetup = { id: string; title: string; status: string; counterpartyId: string };

export async function fetchActiveMeetupWithPeer(
  userId: string,
  peerId: string
): Promise<LinkedMeetup | null> {
  if (!isSupabaseConfigured) return null;

  const { data: myPlans } = await supabase
    .from('plans')
    .select('id,title,status,creator_id,accepted_offer_id')
    .eq('creator_id', userId)
    .in('status', [...LINK_STATUSES]);

  const myPlanIds = (myPlans ?? []).map((p) => p.id);
  if (myPlanIds.length > 0) {
    const { data: offers } = await supabase
      .from('plan_offers')
      .select('plan_id,bidder_id')
      .eq('bidder_id', peerId)
      .in('plan_id', myPlanIds);
    const hit = offers?.[0]?.plan_id;
    if (hit) {
      const plan = (myPlans ?? []).find((p) => p.id === hit);
      if (plan) return { id: plan.id, title: plan.title, status: plan.status, counterpartyId: peerId };
    }
  }

  const { data: theirPlans } = await supabase
    .from('plans')
    .select('id,title,status,creator_id,accepted_offer_id')
    .eq('creator_id', peerId)
    .in('status', [...LINK_STATUSES]);

  const theirPlanIds = (theirPlans ?? []).map((p) => p.id);
  if (theirPlanIds.length === 0) return null;

  const { data: myOffers } = await supabase
    .from('plan_offers')
    .select('plan_id,bidder_id')
    .eq('bidder_id', userId)
    .in('plan_id', theirPlanIds);

  const hit2 = myOffers?.[0]?.plan_id;
  if (!hit2) return null;
  const plan = (theirPlans ?? []).find((p) => p.id === hit2);
  return plan ? { id: plan.id, title: plan.title, status: plan.status, counterpartyId: peerId } : null;
}
