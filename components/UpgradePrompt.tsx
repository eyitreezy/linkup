/**
 * Reusable tier upgrade prompt — motivating, never blocking tone.
 */
import { UpsellGateModal } from '@/components/ui/UpsellGateModal';
import { featureDisplayName, tierDisplayName } from '@/lib/subscription/featureLabels';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type Ion = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  feature: string;
  requiredTier: SubscriptionTier;
  onUpgrade: () => void;
  onDismiss: () => void;
  /** Override default "Unlock {feature}" title. */
  title?: string;
  /** Override default tier message. */
  message?: string;
  icon?: Ion;
};

export function UpgradePrompt({
  visible,
  feature,
  requiredTier,
  onUpgrade,
  onDismiss,
  title,
  message,
  icon = 'sparkles-outline',
}: Props) {
  const featureName = featureDisplayName(feature);
  const tierName = tierDisplayName(requiredTier);

  return (
    <UpsellGateModal
      visible={visible}
      onDismiss={onDismiss}
      onPrimary={onUpgrade}
      title={title ?? `Unlock ${featureName}`}
      message={message ?? `This feature is available on ${tierName} and above.`}
      primaryLabel="View plans"
      icon={icon}
    />
  );
}
