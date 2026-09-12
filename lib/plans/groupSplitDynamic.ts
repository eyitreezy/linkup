import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { budgetFromGrossAmountCents, grossAmountCents } from '@/lib/plans/planFinancialConfig';

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

type GuestEscrowLeg = Pick<
  DbEscrowTransaction,
  'guest_id' | 'guest_share_cents' | 'amount_cents' | 'guest_funded_at' | 'status'
>;

type AcceptedOfferAmount = Pick<DbPlanOffer, 'current_amount_cents' | 'amount_cents'>;

/** Budget (pre-fee) amount for one guest escrow leg — never treat gross amount_cents as budget. */
function guestEscrowBudgetCents(e: GuestEscrowLeg): number {
  const budget = Math.max(0, e.guest_share_cents ?? 0);
  if (budget > 0) return budget;
  const gross = Math.max(0, e.amount_cents ?? 0);
  if (gross > 0) return budgetFromGrossAmountCents(gross);
  return 0;
}

function isGuestEscrowLegFunded(e: GuestEscrowLeg): boolean {
  return (
    !!e.guest_funded_at ||
    e.status === 'funded' ||
    e.status === 'active' ||
    e.status === 'released'
  );
}

/** Sum of locked guest escrow legs (negotiated budget amounts), deduped per guest. */
export function sumAcceptedGuestEscrowCents(escrows: GuestEscrowLeg[]): number {
  const byGuest = new Map<string, number>();
  for (const e of escrows) {
    if (e.guest_id == null) continue;
    const amt = guestEscrowBudgetCents(e);
    const prev = byGuest.get(e.guest_id) ?? 0;
    byGuest.set(e.guest_id, Math.max(prev, amt));
  }
  return [...byGuest.values()].reduce((sum, v) => sum + v, 0);
}

/** Sum of funded guest escrow budget legs only — for live outstanding host share. */
export function sumFundedGuestEscrowBudgetCents(escrows: GuestEscrowLeg[]): number {
  const byGuest = new Map<string, number>();
  for (const e of escrows) {
    if (e.guest_id == null || !isGuestEscrowLegFunded(e)) continue;
    const amt = guestEscrowBudgetCents(e);
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

/** Best-effort guest commitment total for host-share math (budget amounts, pre-fee). */
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

  let guestSum = 0;
  if (fromPlan > 0) {
    guestSum = fromPlan;
  } else if (fromRows > 0) {
    guestSum = fromRows;
  } else if (fromOffers > 0) {
    guestSum = fromOffers;
  }

  // Escrow rows are fresher when the plan column is stale or zero.
  if (fromRows > guestSum) {
    guestSum = fromRows;
  }

  if (total > 0) return Math.min(Math.max(0, guestSum), total);
  return Math.max(0, guestSum);
}

/** Host remaining budget = plan total minus valid guest commitments (matches close_group RPC). */
export function resolveHostRemainingBudgetCents(
  plan: Pick<
    DbPlan,
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
    | 'host_escrow_id'
    | 'group_closed_at'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  acceptedOffers: AcceptedOfferAmount[] = []
): number {
  const total = planTotalCostCents(plan);
  if (total <= 0) return 0;
  const guestSum = resolveAcceptedGuestCommitmentCents(plan, guestEscrows, acceptedOffers);
  return Math.max(0, total - guestSum);
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
    | 'host_escrow_id'
    | 'group_closed_at'
  >,
  guestEscrows: GuestEscrowLeg[] = [],
  acceptedOffers: AcceptedOfferAmount[] = []
): number {
  return resolveHostRemainingBudgetCents(plan, guestEscrows, acceptedOffers);
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
  if (budget > 0) return grossAmountCents(budget);
  return Math.max(0, escrow.amount_cents ?? 0);
}

export type GroupHostSharePlanSlice = Pick<
  DbPlan,
  | 'starting_price_cents'
  | 'agreed_price_cents'
  | 'accepted_guest_amounts_sum_cents'
  | 'host_escrow_id'
  | 'group_closed_at'
  | 'budget_min_cents'
  | 'budget_max_cents'
  | 'currency'
>;

/**
 * Authoritative host share for plan-level screens (no active escrow leg context).
 * displayCents = budget remaining; paymentCents = gross checkout amount.
 */
export function resolveGroupHostShareForPlan(
  plan: GroupHostSharePlanSlice,
  guestEscrows: GuestEscrowLeg[] = [],
  options?: ResolveGroupHostShareOptions
): GroupHostShareResolution {
  const hostEscrowRow = options?.hostEscrowRow ?? null;
  const placeholderEscrow = hostEscrowRow ?? {
    id: plan.host_escrow_id ?? '',
    guest_id: null,
    host_share_cents: 0,
    amount_cents: 0,
  };
  return resolveGroupHostShareCents(plan, placeholderEscrow, guestEscrows, options);
}

export function resolveGroupHostShareCents(
  plan: GroupHostSharePlanSlice,
  escrow: Pick<DbEscrowTransaction, 'id' | 'host_share_cents' | 'amount_cents' | 'guest_id'>,
  guestEscrows: GuestEscrowLeg[] = [],
  options?: ResolveGroupHostShareOptions
): GroupHostShareResolution {
  const acceptedOffers = options?.acceptedOffers ?? [];
  const live = hostShareFromGuestCommitments(plan, guestEscrows, acceptedOffers);
  const projected = projectedHostShareCents(plan);

  const storedEscrow = isGroupHostCloseEscrowRow(plan, escrow)
    ? escrow
    : options?.hostEscrowRow && isGroupHostCloseEscrowRow(plan, options.hostEscrowRow)
      ? options.hostEscrowRow
      : null;
  const stored = storedEscrow ? storedHostBudgetCents(storedEscrow) : 0;
  const storedGross = storedEscrow ? storedHostGrossCents(storedEscrow) : 0;

  // After close, the locked host escrow row is authoritative.
  if (plan.group_closed_at && stored > 0) {
    return { displayCents: stored, paymentCents: storedGross };
  }

  if (live > 0) {
    return { displayCents: live, paymentCents: grossAmountCents(live) };
  }
  if (stored > 0) {
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

export {
  areAllRealGroupEscrowLegsFunded,
  filterRealGroupEscrowRows,
  isGhostHostEscrowRow,
} from '@/lib/plans/groupFundedMemberCount';
