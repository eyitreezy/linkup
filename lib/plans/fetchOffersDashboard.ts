/**
 * Offers involving the current user (sent = bidder, received = on plans they host).
 */
import { isOfferExpired } from '@/lib/plans/offerRules';
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer } from '@/types/database';

export type OfferDashboardRow = {
  offer: DbPlanOffer;
  plan: DbPlan;
  /** The other party: host when you sent; bidder when you received */
  otherUserId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherVerified: boolean;
};

export type OfferDisplayStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export function getOfferDisplayStatus(offer: DbPlanOffer): OfferDisplayStatus {
  if (isOfferExpired(offer)) return 'expired';
  if (offer.status === 'accepted') return 'accepted';
  if (offer.status === 'declined' || offer.status === 'superseded') return 'rejected';
  if (offer.status === 'expired') return 'expired';
  return 'pending';
}

export async function fetchSentOffers(userId: string): Promise<OfferDashboardRow[]> {
  const { data: offers, error } = await supabase
    .from('plan_offers')
    .select('*')
    .eq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return hydrateOfferRows(offers as DbPlanOffer[], userId, 'sent');
}

export async function fetchReceivedOffers(userId: string): Promise<OfferDashboardRow[]> {
  const { data: myPlans, error: pErr } = await supabase.from('plans').select('id').eq('creator_id', userId);
  if (pErr) throw pErr;
  const pids = [...new Set((myPlans ?? []).map((p) => p.id as string))];
  if (pids.length === 0) return [];

  const { data: offers, error } = await supabase
    .from('plan_offers')
    .select('*')
    .in('plan_id', pids)
    .neq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return hydrateOfferRows(offers as DbPlanOffer[], userId, 'received');
}

async function hydrateOfferRows(
  offers: DbPlanOffer[],
  userId: string,
  direction: 'sent' | 'received'
): Promise<OfferDashboardRow[]> {
  if (offers.length === 0) return [];
  const planIds = [...new Set(offers.map((o) => o.plan_id))];
  const { data: plans, error: plErr } = await supabase.from('plans').select('*').in('id', planIds);
  if (plErr) throw plErr;
  const planById = new Map((plans as DbPlan[]).map((p) => [p.id, p]));

  const otherIds = [
    ...new Set(
      offers.map((o) => {
        const p = planById.get(o.plan_id);
        if (!p) return o.bidder_id;
        return direction === 'sent' ? p.creator_id : o.bidder_id;
      })
    ),
  ];

  const { data: profs, error: prErr } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, verified_badge')
    .in('user_id', otherIds);
  if (prErr) throw prErr;
  const profByUser = new Map(
    (profs ?? []).map((r) => [
      r.user_id as string,
      {
        name: (r.display_name as string | null) ?? 'Member',
        avatar: r.avatar_url as string | null,
        verified: !!(r as { verified_badge?: boolean }).verified_badge,
      },
    ])
  );

  const out: OfferDashboardRow[] = [];
  for (const offer of offers) {
    const plan = planById.get(offer.plan_id);
    if (!plan) continue;
    const otherUserId = direction === 'sent' ? plan.creator_id : offer.bidder_id;
    const pr = profByUser.get(otherUserId);
    out.push({
      offer,
      plan,
      otherUserId,
      otherName: pr?.name ?? 'Member',
      otherAvatarUrl: pr?.avatar ?? null,
      otherVerified: pr?.verified ?? false,
    });
  }
  return out;
}
