/**
 * Shown after custom meet type submission or when tapping a pending-approval chip/tile.
 */
import { UpsellGateModal } from '@/components/ui/UpsellGateModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  meetTypeName: string;
  mode: 'submitted' | 'pending';
};

export function MeetTypeReviewPendingModal({ visible, onClose, meetTypeName, mode }: Props) {
  const title = mode === 'submitted' ? 'Meet type submitted!' : 'Awaiting approval';
  const body =
    mode === 'submitted'
      ? `"${meetTypeName}" has been submitted for review. An admin will approve it shortly. You'll be notified when it's ready to use.`
      : `"${meetTypeName}" is still under review by our team. You'll receive a notification once it's approved.`;

  return (
    <UpsellGateModal
      visible={visible}
      onDismiss={onClose}
      onPrimary={onClose}
      title={title}
      message={body}
      primaryLabel="Got it"
      icon="time-outline"
      dismissOnBackdrop={false}
      showDismiss={false}
    />
  );
}
