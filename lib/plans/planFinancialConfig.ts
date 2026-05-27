/**
 * Centralized escrow financial rules (NGN / kobo). Tune without scattering literals.
 */
export const MIN_ESCROW_NGN = 7_000;
export const MAX_ESCROW_TIER1_NGN = 5_000_000;

export const MIN_ESCROW_CENTS = MIN_ESCROW_NGN * 100;
export const MAX_ESCROW_TIER1_CENTS = MAX_ESCROW_TIER1_NGN * 100;

/** Platform fee at release: basis points by amount tier (extend as needed). */
export function platformFeeBpsForAmountCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  const ngn = amountCents / 100;
  if (ngn < 50_000) return 700;
  if (ngn < 500_000) return 600;
  return 500;
}

export function platformFeeCentsForAmount(amountCents: number): number {
  const bps = platformFeeBpsForAmountCents(amountCents);
  return Math.round((amountCents * bps) / 10_000);
}
