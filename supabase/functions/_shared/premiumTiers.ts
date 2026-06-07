/** Server-side tier map — must match app `lib/premium/catalog.ts` (never trust client duration/credits). */

export type ServerPremiumTier = {
  id: string;
  durationDays: number;
  bonusBoostCredits: number;
};

export const PREMIUM_TIERS_SERVER: ServerPremiumTier[] = [
  { id: 'weekly', durationDays: 7, bonusBoostCredits: 1 },
  { id: 'monthly', durationDays: 30, bonusBoostCredits: 4 },
  { id: 'quarterly', durationDays: 90, bonusBoostCredits: 12 },
];

/** Must match `lib/premium/catalog.ts` priceKobo — server never trusts client amount. */
export const PREMIUM_PRICE_KOBO: Record<string, number> = {
  weekly: 150_000,
  monthly: 399_000,
  quarterly: 999_000,
};

export function getServerTier(tierId: string | undefined): ServerPremiumTier | null {
  return PREMIUM_TIERS_SERVER.find((t) => t.id === tierId) ?? null;
}
