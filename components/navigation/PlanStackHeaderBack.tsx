/**
 * Reliable back for nested plan stack — glass pill matches notification inbox top nav.
 */
import { NavigationIconPill } from '@/components/navigation/NavigationIconPill';
import { goToDiscoveryFeed } from '@/lib/navigation/goToDiscoveryFeed';
import { router } from 'expo-router';

export function PlanStackHeaderBack() {
  return (
    <NavigationIconPill
      name="arrow-back"
      accessibilityLabel="Go back"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else goToDiscoveryFeed();
      }}
    />
  );
}
