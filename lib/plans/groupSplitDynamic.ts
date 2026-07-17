import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';

/** Group plan with pattern B (split) and paid commitment — dynamic per-guest shares. */
export function isGroupSplitPlan(
  plan: Pick<DbPlan, 'is_group_plan' | 'escrow_pattern' | 'is_paid'>
): boolean {
  return !!plan.is_group_plan && plan.escrow_pattern === 'B' && !!plan.is_paid;
}

export function planTotalCostCents(
  plan: Pick<
    DbPlan,
    'starting_price_cents' | 'agreed_price_cents' | 'budget_min_cents' | 'budget_max_cents'
  >
): number {
  const starting = plan.starting_price_cents ?? 0;
  const agreed = plan.agreed_price_cents ?? 0;
  const budget = plan.budget_max_cents ?? plan.budget_min_cents ?? 0;
  return Math.max(0, starting, agreed, budget);
}

/** Plan total for group split breakdown — falls back to guest + host sums when fields are empty. */
export function resolveGroupPlanTotalCents(
  plan: Pick<
    DbPlan,
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'current_suggested_share_cents'
    | 'max_guests'
    | 'accepted_guest_count'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  options?: {
    acceptedOffers?: AcceptedOfferAmount[];
    hostEscrowRow?: Pick<DbEscrowTransaction, 'host_share_cents' | 'amount_cents'> | null;
  }
): number {
  const fromFields = planTotalCostCents(plan);
  if (fromFields > 0) return fromFields;

  const guestSum = resolveAcceptedGuestCommitmentCents(
    plan,
    guestEscrows,
    options?.acceptedOffers ?? []
  );
  const hostStored = options?.hostEscrowRow
    ? Math.max(0, options.hostEscrowRow.host_share_cents ?? options.hostEscrowRow.amount_cents ?? 0)
    : 0;

  if (guestSum > 0 && hostStored > 0) return guestSum + hostStored;

  const suggested = plan.current_suggested_share_cents ?? 0;
  const remainingSlots = remainingGuestSlots(plan) + 1;
  if (guestSum > 0 && suggested > 0 && remainingSlots > 0) {
    return guestSum + suggested * remainingSlots;
  }

  if (guestSum > 0) return guestSum + hostStored;

  return 0;
}

export function remainingGuestSlots(
  plan: Pick<DbPlan, 'max_guests' | 'accepted_guest_count'>
): number {
  const max = Math.max(1, plan.max_guests ?? 1);
  const filled = plan.accepted_guest_count ?? 0;
  return Math.max(0, max - filled);
}

/** Mirror of calculate_group_suggested_share — remaining cost ÷ (open guest slots + host). */
export function calculateGroupSuggestedShareCents(
  plan: Pick<
    DbPlan,
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'max_guests'
    | 'accepted_guest_count'
    | 'current_suggested_share_cents'
  >
): number | null {
  const total = planTotalCostCents(plan);
  const guestSum = plan.accepted_guest_amounts_sum_cents ?? 0;
  const remainingCost = total - guestSum;
  const remainingSlots = remainingGuestSlots(plan) + 1;
  if (remainingSlots <= 0 || remainingCost <= 0) {
    return plan.current_suggested_share_cents ?? 0;
  }
  return Math.ceil(remainingCost / remainingSlots);
}

export function projectedHostShareCents(
  plan: Pick<
    DbPlan,
    'starting_price_cents' | 'agreed_price_cents' | 'accepted_guest_amounts_sum_cents'
  >
): number {
  return Math.max(0, planTotalCostCents(plan) - (plan.accepted_guest_amounts_sum_cents ?? 0));
}

type GuestEscrowLeg = Pick<DbEscrowTransaction, 'guest_id' | 'guest_share_cents' | 'amount_cents'>;

type AcceptedOfferAmount = Pick<DbPlanOffer, 'current_amount_cents' | 'amount_cents'>;

/** Sum of locked guest escrow legs (negotiated amounts), deduped per guest. */
export function sumAcceptedGuestEscrowCents(escrows: GuestEscrowLeg[]): number {
  const byGuest = new Map<string, number>();
  for (const e of escrows) {
    if (e.guest_id == null) continue;
    const amt = Math.max(0, e.guest_share_cents ?? e.amount_cents ?? 0);
    const prev = byGuest.get(e.guest_id) ?? 0;
    byGuest.set(e.guest_id, Math.max(prev, amt));
  }
  return [...byGuest.values()].reduce((sum, v) => sum + v, 0);
}

/** Sum from accepted plan offers when escrow rows or plan column are unavailable. */
export function sumAcceptedOfferAmountsCents(offers: AcceptedOfferAmount[]): number {
  return offers.reduce(
    (sum, o) => sum + Math.max(0, o.current_amount_cents ?? o.amount_cents ?? 0),
    0
  );
}

/** Best-effort guest commitment total — prefer server-maintained plan column over escrow rows. */
export function resolveAcceptedGuestCommitmentCents(
  plan: Pick<
    DbPlan,
    | 'accepted_guest_amounts_sum_cents'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  acceptedOffers: AcceptedOfferAmount[] = []
): number {
  const fromPlan = plan.accepted_guest_amounts_sum_cents ?? 0;
  const fromOffers = sumAcceptedOfferAmountsCents(acceptedOffers);
  const fromRows = sumAcceptedGuestEscrowCents(guestEscrows);
  const total = planTotalCostCents(plan);

  if (fromPlan > 0) {
    return total > 0 ? Math.min(fromPlan, total) : fromPlan;
  }
  if (fromOffers > 0) {
    return total > 0 ? Math.min(fromOffers, total) : fromOffers;
  }
  return total > 0 ? Math.min(fromRows, total) : fromRows;
}

/** Host share from plan budget minus accepted guest commitments. */
export function hostShareFromGuestCommitments(
  plan: Pick<
    DbPlan,
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  acceptedOffers: AcceptedOfferAmount[] = []
): number {
  const total = planTotalCostCents(plan);
  if (total <= 0) return 0;
  const guestSum = resolveAcceptedGuestCommitmentCents(plan, guestEscrows, acceptedOffers);
  return Math.max(0, total - guestSum);
}

export function isGroupHostCloseEscrowRow(
  plan: Pick<DbPlan, 'host_escrow_id'>,
  escrow: Pick<DbEscrowTransaction, 'id' | 'guest_id' | 'host_share_cents' | 'amount_cents'>
): boolean {
  if (plan.host_escrow_id) {
    return escrow.id === plan.host_escrow_id;
  }
  return (
    escrow.guest_id == null &&
    Math.max(0, escrow.host_share_cents ?? escrow.amount_cents ?? 0) > 0
  );
}

export type GroupHostShareResolution = {
  displayCents: number;
  paymentCents: number;
};

/**
 * Resolves the host's group-split share for display and checkout.
 * Display uses live guest escrow sums; checkout uses the locked host row after close.
 */
export type ResolveGroupHostShareOptions = {
  acceptedOffers?: AcceptedOfferAmount[];
  /** Host close escrow row when the viewer is on a different leg (e.g. guest row). */
  hostEscrowRow?: Pick<
    DbEscrowTransaction,
    'id' | 'host_share_cents' | 'amount_cents' | 'guest_id'
  > | null;
};

function storedHostBudgetCents(
  escrow: Pick<DbEscrowTransaction, 'host_share_cents' | 'amount_cents'>
): number {
  return Math.max(0, escrow.host_share_cents ?? 0);
}

function storedHostGrossCents(
  escrow: Pick<DbEscrowTransaction, 'host_share_cents' | 'guest_share_cents' | 'amount_cents'>
): number {
  const budget = storedHostBudgetCents(escrow);
  const guestBudget = Math.max(0, escrow.guest_share_cents ?? 0);
  if (budget > 0 && guestBudget > 0) return grossAmountCents(budget);
  return Math.max(0, escrow.amount_cents ?? 0);
}

export function resolveGroupHostShareCents(
  plan: Pick<
    DbPlan,
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'host_escrow_id'
    | 'group_closed_at'
    | 'budget_min_cents'
    | 'budget_max_cents'
  >,
  escrow: Pick<DbEscrowTransaction, 'id' | 'host_share_cents' | 'amount_cents' | 'guest_id'>,
  guestEscrows: GuestEscrowLeg[] = [],
  options?: ResolveGroupHostShareOptions
): GroupHostShareResolution {
  const acceptedOffers = options?.acceptedOffers ?? [];
  const projected = projectedHostShareCents(plan);
  const live = hostShareFromGuestCommitments(plan, guestEscrows, acceptedOffers);

  const storedEscrow = isGroupHostCloseEscrowRow(plan, escrow)
    ? escrow
    : options?.hostEscrowRow && isGroupHostCloseEscrowRow(plan, options.hostEscrowRow)
      ? options.hostEscrowRow
      : null;
  const stored = storedEscrow ? storedHostBudgetCents(storedEscrow) : 0;
  const storedGross = storedEscrow ? storedHostGrossCents(storedEscrow) : 0;

  // After close, the locked host escrow row is authoritative.
  if (plan.group_closed_at && storedGross > 0) {
    return { displayCents: stored, paymentCents: storedGross };
  }

  if (live > 0) {
    return { displayCents: live, paymentCents: grossAmountCents(live) };
  }
  if (storedGross > 0) {
    return { displayCents: stored, paymentCents: storedGross };
  }
  if (projected > 0) {
    return { displayCents: projected, paymentCents: grossAmountCents(projected) };
  }

  return { displayCents: 0, paymentCents: 0 };
}

export function formatGroupSplitCents(cents: number | null | undefined, currency = 'NGN'): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  const n = cents / 100;
  if (currency === 'NGN') return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${n.toFixed(0)} ${currency}`;
}
