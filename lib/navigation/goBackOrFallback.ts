/**
 * Safe back navigation — avoids expo-router GO_BACK warnings when the stack is empty.
 */
import { router, type Href } from 'expo-router';

import { DISCOVERY_FEED_HREF } from '@/lib/navigation/goToDiscoveryFeed';

export function goBackOrFallback(fallbackHref: Href = DISCOVERY_FEED_HREF): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallbackHref);
}
