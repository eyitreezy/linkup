import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import {
  expiredPlanActionCopy,
  type ExpiredPlanAction,
} from '@/lib/plans/expiredPlanMessages';
import type { Href } from 'expo-router';
import { router } from 'expo-router';

type Props = {
  visible: boolean;
  action: ExpiredPlanAction;
  onClose: () => void;
  /** When false, primary action is Close instead of View other plans. */
  showDiscoverCta?: boolean;
};

export function ExpiredPlanActionModal({
  visible,
  action,
  onClose,
  showDiscoverCta = true,
}: Props) {
  const copy = expiredPlanActionCopy(action);

  return (
    <AppConfirmModal
      visible={visible}
      onClose={onClose}
      iconVariant="warning"
      title={copy.title}
      message={copy.message}
      primaryLabel={showDiscoverCta ? 'View other plans' : 'Close'}
      onPrimary={() => {
        onClose();
        if (showDiscoverCta) {
          router.replace('/(tabs)' as Href);
        }
      }}
      secondaryLabel={showDiscoverCta ? 'Close' : 'Dismiss'}
      onSecondary={onClose}
      actionsLayout="stack"
      stackPrimaryFirst
    />
  );
}
