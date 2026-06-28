import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard';
import type { DbUser } from '@/types/database';

type Props = {
  onUpgrade: () => void;
  isSubscriber?: boolean;
  premiumUntilLabel?: string | null;
  dbUser?: DbUser | null;
};

/** Profile membership card — web parity via SubscriptionStatusCard. */
export function PremiumCard({ onUpgrade, dbUser }: Props) {
  return <SubscriptionStatusCard dbUser={dbUser} onPress={onUpgrade} />;
}
