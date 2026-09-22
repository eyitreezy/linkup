export type MatchMakerSortBy = 'best_match' | 'recently_joined';

export type MatchMakerFilterState = {
  /** null = no distance cap (default). */
  maxDistanceKm: number | null;
  sortBy: MatchMakerSortBy;
  /** true when any filter is non-default. */
  filterActive: boolean;
};

export function defaultMatchMakerFilter(): MatchMakerFilterState {
  return {
    maxDistanceKm: null,
    sortBy: 'best_match',
    filterActive: false,
  };
}

export function isMatchMakerFilterActive(
  f: Pick<MatchMakerFilterState, 'maxDistanceKm' | 'sortBy'>
): boolean {
  return f.maxDistanceKm !== null || f.sortBy !== 'recently_joined';
}

export type MatchMakerPoolFetchFilter = {
  maxDistanceKm?: number | null;
  sortBy?: MatchMakerSortBy;
};
