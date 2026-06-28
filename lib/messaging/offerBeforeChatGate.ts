/**
 * Enforce "make an offer first" before opening a cold DM.
 */
import { fetchActiveMeetupWithPeer } from '@/lib/messaging/fetchActiveMeetupWithPeer';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const OPEN_PLAN_STATUSES = ['negotiating', 'agreed', 'awaiting_payment', 'active'] as const;

export type OfferBeforeChatResult =
  | { allowed: true }
  | { allowed: false; planId: string | null };

/** Can the viewer open a 1:1 chat with this peer? */
export async function checkOfferBeforeChat(
  viewerId: string,
  peerId: string
): Promise<OfferBeforeChatResult> {
  if (!isSupabaseConfigured || !viewerId || !peerId || viewerId === peerId) {
    return { allowed: true };
  }

  const linked = await fetchActiveMeetupWithPeer(viewerId, peerId);
  if (linked) return { allowed: true };

  const { data: theirPlans } = await supabase
    .from('plans')
    .select('id')
    .eq('creator_id', peerId)
    .in('status', [...OPEN_PLAN_STATUSES]);

  const theirPlanIds = (theirPlans ?? []).map((p) => p.id as string);
  if (theirPlanIds.length > 0) {
    const { data: viewerOffers } = await supabase
      .from('plan_offers')
      .select('plan_id')
      .eq('bidder_id', viewerId)
      .in('plan_id', theirPlanIds)
      .limit(1);
    if (viewerOffers?.length) return { allowed: true };
  }

  const { data: myPlans } = await supabase
    .from('plans')
    .select('id')
    .eq('creator_id', viewerId)
    .in('status', [...OPEN_PLAN_STATUSES]);

  const myPlanIds = (myPlans ?? []).map((p) => p.id as string);
  if (myPlanIds.length > 0) {
    const { data: peerOffers } = await supabase
      .from('plan_offers')
      .select('plan_id')
      .eq('bidder_id', peerId)
      .in('plan_id', myPlanIds)
      .limit(1);
    if (peerOffers?.length) return { allowed: true };
  }

  return { allowed: false, planId: theirPlanIds[0] ?? null };
}

/** Can the viewer open chat in the context of a specific plan? */
export async function checkOfferBeforeChatOnPlan(
  viewerId: string,
  planId: string,
  isCreator: boolean
): Promise<OfferBeforeChatResult> {
  if (!isSupabaseConfigured || !viewerId || !planId) return { allowed: true };

  const { data: offers } = await supabase
    .from('plan_offers')
    .select('id, bidder_id')
    .eq('plan_id', planId)
    .limit(50);

  const list = offers ?? [];
  if (list.length === 0) return { allowed: false, planId };

  if (isCreator) return { allowed: true };

  const mine = list.some((o) => (o.bidder_id as string) === viewerId);
  return mine ? { allowed: true } : { allowed: false, planId };
}
