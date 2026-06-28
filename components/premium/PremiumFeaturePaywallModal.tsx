/**
 * Inbox-grade paywall — subscribe to unlock a Premium feature.
 */
import { UpsellGateModal } from '@/components/ui/UpsellGateModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onGoPremium: () => void;
  kicker?: string;
  title: string;
  message: string;
  primaryLabel?: string;
};

export function PremiumFeaturePaywallModal({
  visible,
  onClose,
  onGoPremium,
  title,
  message,
  primaryLabel = 'View plans',
}: Props) {
  return (
    <UpsellGateModal
      visible={visible}
      onDismiss={onClose}
      onPrimary={onGoPremium}
      title={title}
      message={message}
      primaryLabel={primaryLabel}
      icon="star-outline"
    />
  );
}
