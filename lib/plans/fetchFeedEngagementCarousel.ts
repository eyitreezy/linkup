/**
 * Home feed engagement carousel: agreements, pending sent offers, pending received offers.
 */
import { fetchAgreementsRail, type AgreementRailItem } from '@/lib/plans/fetchAgreementsRail';
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { isOfferExpired } from '@/lib/plans/offerRules';

export type EngagementCarouselItem = {
  key: string;
  planId: string;
  planTitle: string;
  otherAvatarUrl: string | null;
  otherName: string;
  engagementLabel: string;
  statusLabel: string;
  navigateTo: 'agreement' | 'negotiate';
  sortAt: number;
};

function profLabel(p: { display_name?: string | null } | undefined): string {
  return p?.display_name?.trim() || 'Member';
}

async function profileMapForUsers(userIds: string[]): Promise<Map<string, { name: string; avatar: string | null }>> {
  const u = [...new Set(userIds)];
  if (u.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', u);
  return new Map(
    (data ?? []).map((r) => [
      r.user_id as string,
      {
        name: profLabel(r as { display_name?: string | null }),
        avatar: r.avatar_url as string | null,
      },
    ])
  );
}

export async function fetchFeedEngagementCarousel(userId: string): Promise<EngagementCarouselItem[]> {
  const out: EngagementCarouselItem[] = [];

  let agreements: AgreementRailItem[] = [];
  try {
    agreements = await fetchAgreementsRail(userId);
  } catch {
    agreements = [];
  }

  const agrTime = Date.now();
  for (const a of agreements) {
    out.push({
      key: `agr-${a.planId}`,
      planId: a.planId,
      planTitle: a.planTitle,
      otherAvatarUrl: a.counterpartAvatarUrl,
      otherName: a.counterpartName,
      engagementLabel: 'Ongoing plan',
      statusLabel: a.statusLabel,
      navigateTo: 'agreement',
      sortAt: agrTime + 1,
    });
  }

  const { data: sentRows, error: sErr } = await supabase
    .from('plan_offers')
    .select('*')
    .eq('bidder_id', userId)
    .in('status', ['pending', 'countered'])
    .order('created_at', { ascending: false });
  if (!sErr && sentRows?.length) {
    const offers = sentRows as DbPlanOffer[];
    const pids = [...new Set(offers.map((o) => o.plan_id))];
    const { data: splans } = await supabase
      .from('plans')
      .select('id, title, status, creator_id, updated_at')
      .in('id', pids);
    const planById = new Map((splans as DbPlan[] | null)?.map((p) => [p.id, p]) ?? []);
    const creatorIds = [...new Set([...planById.values()].map((p) => p.creator_id))];
    const creators = await profileMapForUsers(creatorIds);
    const seen = new Set<string>();
    for (const o of offers) {
      const p = planById.get(o.plan_id);
      if (!p || p.status !== 'negotiating') continue;
      if (isOfferExpired(o)) continue;
      if (seen.has(o.plan_id)) continue;
      seen.add(o.plan_id);
      const pr = creators.get(p.creator_id);
      out.push({
        key: `sent-${o.id}`,
        planId: p.id,
        planTitle: p.title,
        otherAvatarUrl: pr?.avatar ?? null,
        otherName: pr?.name ?? 'Host',
        engagementLabel: 'Offer sent',
        statusLabel: 'Pending',
        navigateTo: 'negotiate',
        sortAt: new Date(o.created_at).getTime(),
      });
    }
  }

  const { data: myNegPlans } = await supabase
    .from('plans')
    .select('id, title, updated_at')
    .eq('creator_id', userId)
    .eq('status', 'negotiating');
  const negIds = (myNegPlans ?? []).map((r) => r.id as string);
  if (negIds.length > 0) {
    const { data: recvRows } = await supabase
      .from('plan_offers')
      .select('*')
      .in('plan_id', negIds)
      .in('status', ['pending', 'countered'])
      .neq('bidder_id', userId)
      .order('created_at', { ascending: false });
    const recv = (recvRows ?? []) as DbPlanOffer[];
    const bidderIds = [...new Set(recv.map((o) => o.bidder_id))];
    const bidders = await profileMapForUsers(bidderIds);
    const seenPlan = new Set<string>();
    for (const o of recv) {
      if (isOfferExpired(o)) continue;
      if (seenPlan.has(o.plan_id)) continue;
      seenPlan.add(o.plan_id);
      const pl = (myNegPlans ?? []).find((x) => x.id === o.plan_id) as
        | { id: string; title: string; updated_at: string }
        | undefined;
      if (!pl) continue;
      const pr = bidders.get(o.bidder_id);
      out.push({
        key: `recv-${o.id}`,
        planId: pl.id,
        planTitle: pl.title,
        otherAvatarUrl: pr?.avatar ?? null,
        otherName: pr?.name ?? 'Guest',
        engagementLabel: 'Offer received',
        statusLabel: 'Pending',
        navigateTo: 'negotiate',
        sortAt: new Date(o.created_at).getTime(),
      });
    }
  }

  const byKey = new Map<string, EngagementCarouselItem>();
  for (const item of out) {
    if (!byKey.has(item.key)) byKey.set(item.key, item);
  }
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => {
    const aa = a.key.startsWith('agr-') ? 1 : 0;
    const bb = b.key.startsWith('agr-') ? 1 : 0;
    if (aa !== bb) return bb - aa;
    return b.sortAt - a.sortAt;
  });
  return merged;
}
