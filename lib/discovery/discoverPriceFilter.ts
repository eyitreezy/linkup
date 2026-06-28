import type { PlanFeedRow } from '@/components/plans/planFeedTypes';

export type DiscoverPriceFilter = {
  minPriceCents: number | null;
  maxPriceCents: number | null;
};

/** Treat null, undefined, non-finite, and non-positive values as "not provided". */
export function normalizeDiscoverPriceCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function hasDiscoverPriceFilter(
  filter: Pick<DiscoverPriceFilter, 'minPriceCents' | 'maxPriceCents'>
): boolean {
  return (
    normalizeDiscoverPriceCents(filter.minPriceCents) != null ||
    normalizeDiscoverPriceCents(filter.maxPriceCents) != null
  );
}

export function discoverPriceFilterBounds(
  filter: Pick<DiscoverPriceFilter, 'minPriceCents' | 'maxPriceCents'>
): { minPriceCents: number | null; maxPriceCents: number | null } {
  return {
    minPriceCents: normalizeDiscoverPriceCents(filter.minPriceCents),
    maxPriceCents: normalizeDiscoverPriceCents(filter.maxPriceCents),
  };
}

/** Price used for discover min/max filtering — matches card display (`starting_price_cents`). */
export function resolvePlanFilterPriceCents(
  row: Pick<
    PlanFeedRow,
    'starting_price_cents' | 'budget_min_cents' | 'budget_max_cents' | 'is_paid'
  >
): number | null {
  const starting = normalizeDiscoverPriceCents(row.starting_price_cents);
  if (starting != null) return starting;
  if (!row.is_paid) return null;
  return (
    normalizeDiscoverPriceCents(row.budget_max_cents) ??
    normalizeDiscoverPriceCents(row.budget_min_cents)
  );
}

/** Rejects invalid ranges before applying filters or running queries. */
export function validateDiscoverPriceRange(
  minPriceCents: number | null | undefined,
  maxPriceCents: number | null | undefined
): string | null {
  const min = normalizeDiscoverPriceCents(minPriceCents);
  const max = normalizeDiscoverPriceCents(maxPriceCents);
  if (min != null && max != null && min > max) {
    return 'Minimum price cannot be higher than maximum.';
  }
  return null;
}

/**
 * Inclusive price gate for a plan row.
 * - Both bounds: min <= price <= max
 * - Min only: price >= min
 * - Max only: price <= max
 * - Neither: always passes
 * Rows without a numeric price fail when any bound is set.
 */
export function passesDiscoverPriceFilter(
  priceCents: number | null | undefined,
  minPriceCents: number | null | undefined,
  maxPriceCents: number | null | undefined
): boolean {
  const min = normalizeDiscoverPriceCents(minPriceCents);
  const max = normalizeDiscoverPriceCents(maxPriceCents);
  if (min == null && max == null) return true;

  if (priceCents == null || !Number.isFinite(priceCents)) return false;
  const price = Math.round(priceCents);

  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}

export function planPassesDiscoverPriceFilter(
  row: Pick<
    PlanFeedRow,
    'starting_price_cents' | 'budget_min_cents' | 'budget_max_cents' | 'is_paid'
  >,
  filter: DiscoverPriceFilter
): boolean {
  if (!hasDiscoverPriceFilter(filter)) return true;
  const { minPriceCents, maxPriceCents } = discoverPriceFilterBounds(filter);
  return passesDiscoverPriceFilter(resolvePlanFilterPriceCents(row), minPriceCents, maxPriceCents);
}

export function applyDiscoverPriceFilterToRows<T extends PlanFeedRow>(
  rows: T[],
  filter: DiscoverPriceFilter
): T[] {
  if (!hasDiscoverPriceFilter(filter)) return rows;
  return rows.filter((row) => planPassesDiscoverPriceFilter(row, filter));
}

/** Bounds for Supabase `.gte` / `.lte` on `starting_price_cents` when client filters are active. */
export function discoverPriceFilterForQuery(
  filter: Pick<FeedFilterStateLike, 'clientFiltersActive' | 'minPriceCents' | 'maxPriceCents'>
): DiscoverPriceFilter | null {
  if (!filter.clientFiltersActive) return null;
  const bounds = discoverPriceFilterBounds(filter);
  return hasDiscoverPriceFilter(bounds) ? bounds : null;
}

type FeedFilterStateLike = {
  clientFiltersActive: boolean;
  minPriceCents: number | null;
  maxPriceCents: number | null;
};
