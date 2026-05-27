/**
 * Navigate to the discovery Plans tab from nested stacks (plan, chat, escrow, etc.).
 */
import { router, type Href } from 'expo-router';

/** Main tab shell; default route is Discover (`index`). */
export const DISCOVERY_FEED_HREF = '/(tabs)' as Href;

/**
 * Pop nested routes until the tab shell is active, then show the feed.
 * `dismissTo` falls back to `replace` when the tab route is not in history.
 */
export function goToDiscoveryFeed(): void {
  router.dismissTo(DISCOVERY_FEED_HREF);
}
