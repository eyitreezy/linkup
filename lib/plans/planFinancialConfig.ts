/**
 * Centralized escrow financial rules (NGN / kobo).
 * Keep in sync with linkup-web/src/lib/plans/planFinancialConfig.ts
 * See PLATFORM_FEE.md — flat 5% fee, gross escrow storage, 50% goodwill cap.
 */
export const MIN_ESCROW_NGN = 7_000;
export const MAX_ESCROW_TIER1_NGN = 5_000_000;

export const MIN_ESCROW_CENTS = MIN_ESCROW_NGN * 100;
export const MAX_ESCROW_TIER1_CENTS = MAX_ESCROW_TIER1_NGN * 100;

/** Flat 5% platform fee on all plan budget amounts (500 basis points). */
export const PLATFORM_FEE_BPS = 500;

/** Goodwill credits can offset at most 50% of the platform fee. */
export const GOODWILL_MAX_FEE_OFFSET_PCT = 50;

export function platformFeeBpsForAmountCents(_amountCents: number): number {
  return PLATFORM_FEE_BPS;
}

/** Platform fee from a plan budget amount (kobo). */
export function platformFeeCentsForAmount(budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  return Math.round((budgetCents * PLATFORM_FEE_BPS) / 10_000);
}

/** Gross escrow amount stored at creation: budget + fee. */
export function grossAmountCents(budgetCents: number): number {
  return budgetCents + platformFeeCentsForAmount(budgetCents);
}

/** Budget portion embedded in a gross escrow amount. */
export function budgetFromGrossAmountCents(grossCents: number): number {
  if (grossCents <= 0) return 0;
  return Math.round(grossCents / 1.05);
}

/** Fee portion embedded in a gross escrow amount. */
export function feeFromGrossAmountCents(grossCents: number): number {
  return grossCents - budgetFromGrossAmountCents(grossCents);
}

type PatternBLegEscrowFields = {
  amount_cents: number;
  host_share_cents?: number | null;
  guest_share_cents?: number | null;
};

/** Gross checkout amount for one pattern B leg (single-leg rows use amount_cents). */
export function patternBLegGrossCents(
  escrow: PatternBLegEscrowFields,
  leg: 'host' | 'guest'
): number {
  const hostBudget = Math.max(0, escrow.host_share_cents ?? 0);
  const guestBudget = Math.max(0, escrow.guest_share_cents ?? 0);
  if (leg === 'host') {
    if (hostBudget > 0 && guestBudget > 0) return grossAmountCents(hostBudget);
    return Math.max(0, escrow.amount_cents);
  }
  if (guestBudget > 0 && hostBudget > 0) return grossAmountCents(guestBudget);
  return Math.max(0, escrow.amount_cents);
}

/** Max goodwill offset for a given full fee amount. */
export function goodwillMaxOffsetCents(feeCents: number): number {
  if (feeCents <= 0) return 0;
  return Math.floor((feeCents * GOODWILL_MAX_FEE_OFFSET_PCT) / 100);
}

export function formatPlatformFeeDisplay(budgetCents: number): {
  feeCents: number;
  grossCents: number;
  feePercentLabel: string;
} {
  const feeCents = platformFeeCentsForAmount(budgetCents);
  return {
    feeCents,
    grossCents: grossAmountCents(budgetCents),
    feePercentLabel: '5%',
  };
}
