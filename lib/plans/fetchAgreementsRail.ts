/**
 * Active agreements for the Plans home “connections” rail (host + accepted guest).
 * Includes 1:1 plans in agreed/awaiting_payment/active and group plan accepted slots.
 */
import { supabase } from '@/lib/supabase';
import type { PlanStatus } from '@/types/database';

const AGREEMENT_STATUSES: PlanStatus[] = ['agreed', 'awaiting_payment', 'active'];

const GROUP_SLOT_PLAN_STATUSES: PlanStatus[] = ['negotiating', 'agreed', 'awaiting_payment', 'active'];

type PlanSlice = {
  id: string;
  title: string;
  status: PlanStatus;
  is_group_plan?: boolean;
  accepted_offer_id: string | null;
  agreed_scheduled_at: string | null;
  location_label: string | null;
  scheduled_at: string | null;
  updated_at: string;
  creator_id?: string;
};

export type AgreementRailItem = {
  planId: string;
  offerId?: string;
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

function statusLabelForPlan(status: PlanStatus): string {
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

function groupSlotStatusLabel(hasEscrow: boolean): string {
  return hasEscrow ? 'Payment' : 'Confirm';
}

function whenHint(plan: PlanSlice, offerSchedule?: string | null): string | null {
  const iso = plan.agreed_scheduled_at ?? offerSchedule ?? plan.scheduled_at ?? null;
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
      'id, title, status, is_group_plan, accepted_offer_id, agreed_scheduled_at, location_label, scheduled_at, updated_at'
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
    .select('id, plan_id, proposed_scheduled_at, updated_at')
    .eq('bidder_id', userId)
    .eq('status', 'accepted');

  if (goErr) throw goErr;

  const planIds = [...new Set((guestOffers ?? []).map((o) => o.plan_id as string))];
  let guestPlanById = new Map<string, PlanSlice>();
  if (planIds.length > 0) {
    const { data: gPlans, error: gpErr } = await supabase
      .from('plans')
      .select(
        'id, title, status, is_group_plan, accepted_offer_id, agreed_scheduled_at, location_label, scheduled_at, updated_at, creator_id'
      )
      .in('id', planIds);
    if (gpErr) throw gpErr;
    guestPlanById = new Map((gPlans ?? []).map((p) => [p.id as string, p as PlanSlice]));
  }

  const { data: groupHostPlans, error: ghErr } = await supabase
    .from('plans')
    .select(
      'id, title, status, is_group_plan, accepted_offer_id, agreed_scheduled_at, location_label, scheduled_at, updated_at, creator_id'
    )
    .eq('creator_id', userId)
    .eq('is_group_plan', true)
    .in('status', GROUP_SLOT_PLAN_STATUSES);

  if (ghErr) throw ghErr;

  const groupPlanIds = [
    ...new Set([
      ...(groupHostPlans ?? []).map((p) => p.id as string),
      ...(guestOffers ?? [])
        .map((o) => guestPlanById.get(o.plan_id as string))
        .filter((p): p is PlanSlice => !!p?.is_group_plan)
        .map((p) => p.id),
    ]),
  ];

  type AcceptedOfferRow = {
    id: string;
    plan_id: string;
    bidder_id: string;
    proposed_scheduled_at: string | null;
    updated_at: string;
  };

  let groupAcceptedOffers: AcceptedOfferRow[] = [];
  if (groupPlanIds.length > 0) {
    const { data: gaOffers, error: gaErr } = await supabase
      .from('plan_offers')
      .select('id, plan_id, bidder_id, proposed_scheduled_at, updated_at')
      .in('plan_id', groupPlanIds)
      .eq('status', 'accepted');
    if (gaErr) throw gaErr;
    groupAcceptedOffers = (gaOffers ?? []) as AcceptedOfferRow[];
  }

  const escrowGuestKeys = new Set<string>();
  if (groupPlanIds.length > 0) {
    const { data: escrows } = await supabase
      .from('escrow_transactions')
      .select('plan_id, guest_id')
      .in('plan_id', groupPlanIds);
    for (const e of escrows ?? []) {
      escrowGuestKeys.add(`${e.plan_id as string}:${e.guest_id as string}`);
    }
  }

  const groupPlanById = new Map<string, PlanSlice>();
  for (const p of groupHostPlans ?? []) {
    groupPlanById.set(p.id as string, p as PlanSlice);
  }
  for (const p of guestPlanById.values()) {
    if (p.is_group_plan) groupPlanById.set(p.id, p);
  }

  type Merged = {
    plan: PlanSlice;
    counterpartId: string;
    role: 'host' | 'guest';
    offerId: string;
    sortAt: number;
    statusLabel: string;
    whenHint: string | null;
  };
  const merged: Merged[] = [];

  for (const p of hostPlans ?? []) {
    const pl = p as PlanSlice;
    if (!pl.accepted_offer_id || pl.is_group_plan) continue;
    const bid = bidderByOffer.get(pl.accepted_offer_id);
    if (!bid) continue;
    merged.push({
      plan: pl,
      counterpartId: bid,
      role: 'host',
      offerId: pl.accepted_offer_id,
      sortAt: new Date(pl.updated_at).getTime(),
      statusLabel: statusLabelForPlan(pl.status),
      whenHint: whenHint(pl),
    });
  }

  for (const o of guestOffers ?? []) {
    const p = guestPlanById.get(o.plan_id as string);
    if (!p) continue;
    if (p.is_group_plan) {
      if (!GROUP_SLOT_PLAN_STATUSES.includes(p.status)) continue;
      merged.push({
        plan: p,
        counterpartId: p.creator_id!,
        role: 'guest',
        offerId: o.id as string,
        sortAt: new Date((o.updated_at as string) ?? p.updated_at).getTime(),
        statusLabel: groupSlotStatusLabel(escrowGuestKeys.has(`${p.id}:${userId}`)),
        whenHint: whenHint(p, o.proposed_scheduled_at as string | null),
      });
      continue;
    }
    if (!AGREEMENT_STATUSES.includes(p.status) || p.accepted_offer_id !== o.id) continue;
    merged.push({
      plan: p,
      counterpartId: p.creator_id!,
      role: 'guest',
      offerId: o.id as string,
      sortAt: new Date(p.updated_at).getTime(),
      statusLabel: statusLabelForPlan(p.status),
      whenHint: whenHint(p, o.proposed_scheduled_at as string | null),
    });
  }

  for (const o of groupAcceptedOffers) {
    const p = groupPlanById.get(o.plan_id);
    if (!p) continue;
    const isHostSlot = p.creator_id === userId;
    const counterpartId = isHostSlot ? o.bidder_id : p.creator_id!;
    if (!isHostSlot && o.bidder_id !== userId) continue;
    merged.push({
      plan: p,
      counterpartId,
      role: isHostSlot ? 'host' : 'guest',
      offerId: o.id,
      sortAt: new Date(o.updated_at ?? p.updated_at).getTime(),
      statusLabel: groupSlotStatusLabel(escrowGuestKeys.has(`${p.id}:${o.bidder_id}`)),
      whenHint: whenHint(p, o.proposed_scheduled_at),
    });
  }

  const bySlot = new Map<string, Merged>();
  for (const m of merged) {
    bySlot.set(`${m.plan.id}:${m.offerId}`, m);
  }
  const unique = Array.from(bySlot.values());

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

  const items = unique.map((m) => {
    const pr = profByUser.get(m.counterpartId);
    const row: AgreementRailItem = {
      planId: m.plan.id,
      offerId: m.offerId,
      planTitle: m.plan.title,
      planStatus: m.plan.status,
      counterpartUserId: m.counterpartId,
      counterpartName: pr?.name ?? 'Member',
      counterpartAvatarUrl: pr?.avatar ?? null,
      counterpartVerified: pr?.verified ?? false,
      role: m.role,
      statusLabel: m.statusLabel,
      whenHint: m.whenHint,
    };
    return { row, sortAt: m.sortAt };
  });

  items.sort((a, b) => b.sortAt - a.sortAt);
  return items.map((x) => x.row);
}
