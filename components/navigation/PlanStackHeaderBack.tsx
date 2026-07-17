/**
 * Reliable back for nested plan stack — glass pill matches notification inbox top nav.
 */
import { NavigationIconPill } from '@/components/navigation/NavigationIconPill';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';

export function PlanStackHeaderBack() {
  return (
    <NavigationIconPill
      name="arrow-back"
      accessibilityLabel="Go back"
      onPress={() => goBackOrFallback()}
    />
  );
}
