import type { FeedFilterState } from '@/components/plans/PlansFilterSheet';

type StoredFeedFilters = {
  maxDistanceKm?: number | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  verifiedHostsOnly?: boolean;
  /** Set when the user taps Apply in the filter sheet with at least one constraint. */
  clientFiltersActive?: boolean;
  /** @deprecated Old max-price slider stored cents in `maxPrice`, not `maxPriceCents`. Ignored. */
  maxPrice?: number | null;
};

function normalizePriceCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function defaultDiscoverFeedFilter(fallbackMaxKm: number): FeedFilterState {
  return {
    maxDistanceKm: fallbackMaxKm,
    minPriceCents: null,
    maxPriceCents: null,
    verifiedHostsOnly: false,
    clientFiltersActive: false,
  };
}

/** True when Apply should turn on client-side price / distance / verified filtering. */
export function isDiscoverFilterConstraintActive(
  f: Pick<
    FeedFilterState,
    'maxDistanceKm' | 'minPriceCents' | 'maxPriceCents' | 'verifiedHostsOnly'
  >,
  baseRadiusKm: number
): boolean {
  if (f.verifiedHostsOnly) return true;
  if (f.minPriceCents != null) return true;
  if (f.maxPriceCents != null) return true;
  if (f.maxDistanceKm !== baseRadiusKm) return true;
  return false;
}

/** Hydrate discover filters from `profiles.preferences.feed_filters`. */
export function parseStoredFeedFilters(raw: unknown, fallbackMaxKm: number): FeedFilterState {
  const defaults = defaultDiscoverFeedFilter(fallbackMaxKm);
  if (!raw || typeof raw !== 'object') return defaults;

  const f = raw as StoredFeedFilters;
  const draft = {
    maxDistanceKm:
      typeof f.maxDistanceKm === 'number' && f.maxDistanceKm > 0 ? f.maxDistanceKm : fallbackMaxKm,
    minPriceCents: normalizePriceCents(f.minPriceCents),
    maxPriceCents:
      f.clientFiltersActive === true ? normalizePriceCents(f.maxPriceCents) : null,
    verifiedHostsOnly: !!f.verifiedHostsOnly,
  };

  const clientFiltersActive =
    f.clientFiltersActive === true || isDiscoverFilterConstraintActive(draft, fallbackMaxKm);

  if (!clientFiltersActive) return defaults;

  return { ...draft, clientFiltersActive: true };
}
