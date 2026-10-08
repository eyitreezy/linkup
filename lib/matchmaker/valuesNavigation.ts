import { router, type Href } from 'expo-router';

export const MATCHMAKER_SETTINGS_ROUTE = '/matchmaker/settings' as Href;

/** Exit a MatchMaker values screen opened from Settings without popping through onboarding stack frames. */
export function exitMatchMakerSettingsEdit(): void {
  router.replace(MATCHMAKER_SETTINGS_ROUTE);
}

export function isSettingsEditOrigin(fromParam: string | string[] | undefined): boolean {
  if (fromParam === 'settings') return true;
  if (Array.isArray(fromParam)) return fromParam.includes('settings');
  return false;
}
