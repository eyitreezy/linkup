import type { FeedFilterState } from '@/components/plans/PlansFilterSheet';
import {
  hasDiscoverPriceFilter,
  normalizeDiscoverPriceCents,
} from '@/lib/discovery/discoverPriceFilter';
import type { HostPresenceFilter } from '@/lib/presence/derivePresenceUi';

type StoredFeedFilters = {
  maxDistanceKm?: number | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  verifiedHostsOnly?: boolean;
  hostPresence?: HostPresenceFilter;
  /** Set when the user taps Apply in the filter sheet with at least one constraint. */
  clientFiltersActive?: boolean;
  /** When true, maxDistanceKm strictly excludes out-of-range plans. */
  distanceFilterActive?: boolean;
  /** @deprecated Old max-price slider stored cents in `maxPrice`, not `maxPriceCents`. Ignored. */
  maxPrice?: number | null;
};

export function defaultDiscoverFeedFilter(_fallbackMaxKm: number): FeedFilterState {
  return {
    maxDistanceKm: null,
    minPriceCents: null,
    maxPriceCents: null,
    verifiedHostsOnly: false,
    hostPresence: 'all',
    clientFiltersActive: false,
    distanceFilterActive: false,
  };
}

function parseHostPresence(raw: unknown): HostPresenceFilter {
  if (raw === 'online' || raw === 'offline') return raw;
  return 'all';
}

/** True when Apply should turn on client-side price / verified / host-presence filtering. */
export function isDiscoverFilterConstraintActive(
  f: Pick<
    FeedFilterState,
    'maxDistanceKm' | 'minPriceCents' | 'maxPriceCents' | 'verifiedHostsOnly' | 'hostPresence'
  >,
  _baseRadiusKm: number
): boolean {
  if (f.hostPresence !== 'all') return true;
  if (f.verifiedHostsOnly) return true;
  if (hasDiscoverPriceFilter(f)) return true;
  return false;
}

/** True when price, verified-host, or host-presence constraints are set (excludes distance). */
export function hasAdvancedDiscoverFilters(
  f: Pick<
    FeedFilterState,
    'minPriceCents' | 'maxPriceCents' | 'verifiedHostsOnly' | 'hostPresence'
  >
): boolean {
  if (f.hostPresence !== 'all') return true;
  if (f.verifiedHostsOnly) return true;
  if (hasDiscoverPriceFilter(f)) return true;
  return false;
}

/** Hydrate discover filters from `profiles.preferences.feed_filters`. */
export function parseStoredFeedFilters(raw: unknown, fallbackMaxKm: number): FeedFilterState {
  const defaults = defaultDiscoverFeedFilter(fallbackMaxKm);
  if (!raw || typeof raw !== 'object') return defaults;

  const f = raw as StoredFeedFilters;
  const storedMaxKm =
    typeof f.maxDistanceKm === 'number' && f.maxDistanceKm > 0 ? f.maxDistanceKm : null;

  const distanceFilterActive =
    f.distanceFilterActive === true && storedMaxKm != null;

  const draft = {
    maxDistanceKm: distanceFilterActive ? storedMaxKm : null,
    minPriceCents: normalizeDiscoverPriceCents(f.minPriceCents),
    maxPriceCents: normalizeDiscoverPriceCents(f.maxPriceCents),
    verifiedHostsOnly: !!f.verifiedHostsOnly,
    hostPresence: parseHostPresence(f.hostPresence),
    clientFiltersActive: false,
    distanceFilterActive,
  };

  const hasOtherConstraints = isDiscoverFilterConstraintActive(draft, fallbackMaxKm);

  if (!distanceFilterActive && !hasOtherConstraints && f.clientFiltersActive !== true) {
    return defaults;
  }

  return {
    ...draft,
    clientFiltersActive: distanceFilterActive || hasOtherConstraints || f.clientFiltersActive === true,
    distanceFilterActive,
  };
}
