/**
 * Active agreements for the Plans home “connections” rail (host + accepted guest).
 */
import { supabase } from '@/lib/supabase';
import type { PlanStatus } from '@/types/database';

const AGREEMENT_STATUSES: PlanStatus[] = ['agreed', 'awaiting_payment', 'active'];

type PlanSlice = {
  id: string;
  title: string;
  status: PlanStatus;
  accepted_offer_id: string | null;
  agreed_scheduled_at: string | null;
  location_label: string | null;
  scheduled_at: string | null;
  updated_at: string;
  creator_id?: string;
};

export type AgreementRailItem = {
  planId: string;
  planTitle: string;
  planStatus: PlanStatus;
  counterpartUserId: string;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  counterpartVerified: boolean;
  role: 'host' | 'guest';
  statusLabel: string;
  whenHint: string | null;
};

function statusLabel(status: PlanStatus): string {
  switch (status) {
    case 'agreed':
      return 'Confirm';
    case 'awaiting_payment':
      return 'Payment';
    case 'active':
      return 'Active';
    default:
      return status;
  }
}

function whenHint(plan: PlanSlice): string | null {
  const iso = plan.agreed_scheduled_at ?? plan.scheduled_at ?? null;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }
  const loc = plan.location_label?.trim();
  if (loc) return loc.length > 24 ? `${loc.slice(0, 22)}…` : loc;
  return null;
}

export async function fetchAgreementsRail(userId: string): Promise<AgreementRailItem[]> {
  const { data: hostPlans, error: hostErr } = await supabase
    .from('plans')
    .select(
      'id, title, status, accepted_offer_id, agreed_scheduled_at, location_label, scheduled_at, updated_at'
    )
    .eq('creator_id', userId)
    .in('status', AGREEMENT_STATUSES)
    .not('accepted_offer_id', 'is', null);

  if (hostErr) throw hostErr;

  const offerIds = [...new Set((hostPlans ?? []).map((p) => p.accepted_offer_id).filter(Boolean))] as string[];

  let bidderByOffer = new Map<string, string>();
  if (offerIds.length > 0) {
    const { data: bids, error: bidErr } = await supabase
      .from('plan_offers')
      .select('id, bidder_id')
      .in('id', offerIds);
    if (bidErr) throw bidErr;
    bidderByOffer = new Map((bids ?? []).map((r) => [r.id as string, r.bidder_id as string]));
  }

  const { data: guestOffers, error: goErr } = await supabase
    .from('plan_offers')
    .select('id, plan_id')
    .eq('bidder_id', userId)
    .eq('status', 'accepted');

  if (goErr) throw goErr;

  const planIds = [...new Set((guestOffers ?? []).map((o) => o.plan_id as string))];
  let guestPlanById = new Map<string, PlanSlice>();
  if (planIds.length > 0) {
    const { data: gPlans, error: gpErr } = await supabase
      .from('plans')
      .select(
        'id, title, status, accepted_offer_id, agreed_scheduled_at, location_label, scheduled_at, updated_at, creator_id'
      )
      .in('id', planIds)
      .in('status', AGREEMENT_STATUSES);
    if (gpErr) throw gpErr;
    guestPlanById = new Map((gPlans ?? []).map((p) => [p.id as string, p as PlanSlice]));
  }

  type Merged = { plan: PlanSlice; counterpartId: string; role: 'host' | 'guest' };
  const merged: Merged[] = [];

  for (const p of hostPlans ?? []) {
    const pl = p as PlanSlice;
    if (!pl.accepted_offer_id) continue;
    const bid = bidderByOffer.get(pl.accepted_offer_id);
    if (!bid) continue;
    merged.push({ plan: pl, counterpartId: bid, role: 'host' });
  }

  for (const o of guestOffers ?? []) {
    const p = guestPlanById.get(o.plan_id as string);
    if (!p || p.accepted_offer_id !== o.id) continue;
    merged.push({ plan: p, counterpartId: p.creator_id!, role: 'guest' });
  }

  const byPlan = new Map<string, Merged>();
  for (const m of merged) {
    byPlan.set(m.plan.id, m);
  }
  const unique = Array.from(byPlan.values());

  const counterpartIds = [...new Set(unique.map((u) => u.counterpartId))];
  if (counterpartIds.length === 0) return [];

  const { data: profs, error: prErr } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, verified_badge')
    .in('user_id', counterpartIds);
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

  const items = unique.map(({ plan, counterpartId, role }) => {
    const pr = profByUser.get(counterpartId);
    const sortAt = new Date(plan.updated_at).getTime();
    const row: AgreementRailItem = {
      planId: plan.id,
      planTitle: plan.title,
      planStatus: plan.status,
      counterpartUserId: counterpartId,
      counterpartName: pr?.name ?? 'Member',
      counterpartAvatarUrl: pr?.avatar ?? null,
      counterpartVerified: pr?.verified ?? false,
      role,
      statusLabel: statusLabel(plan.status),
      whenHint: whenHint(plan),
    };
    return { row, sortAt };
  });

  items.sort((a, b) => b.sortAt - a.sortAt);
  return items.map((x) => x.row);
}
