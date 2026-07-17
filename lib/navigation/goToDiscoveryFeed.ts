/**
 * Navigate to the discovery Plans tab from nested stacks (plan, chat, escrow, etc.).
 */
import { router, type Href } from 'expo-router';

/** Main tab shell; default route is Discover (`index`). */
export const DISCOVERY_FEED_HREF = '/(tabs)' as Href;

/**
 * Pop nested routes until the tab shell is active, then show the feed.
 * Uses replace when there is nothing to dismiss (avoids unhandled GO_BACK).
 */
export function goToDiscoveryFeed(): void {
  if (router.canDismiss()) {
    router.dismissTo(DISCOVERY_FEED_HREF);
    return;
  }
  router.replace(DISCOVERY_FEED_HREF);
}
