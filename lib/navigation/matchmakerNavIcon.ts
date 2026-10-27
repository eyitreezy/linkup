/** Inactive nav glyph fill — matches web sidebar `BottomNav` / `--muted`. */
export const MATCHMAKER_NAV_INACTIVE_FILL = '#6B7280';

/** Whether the current route is under the MatchMaker product area. */
export function isMatchMakerProductRoute(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  return path === '/matchmaker' || path.startsWith('/matchmaker/');
}

export const MATCHMAKER_NAV_ASSET_BASENAMES = {
  active: 'matchmaker-active.png',
  inactive: 'matchmaker-inactive.png',
} as const;

export function matchMakerNavIconBasename(active: boolean): string {
  return active
    ? MATCHMAKER_NAV_ASSET_BASENAMES.active
    : MATCHMAKER_NAV_ASSET_BASENAMES.inactive;
}
