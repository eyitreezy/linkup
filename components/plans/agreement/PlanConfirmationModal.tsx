/**
 * PL6a — destructive / high-stakes confirmation (cancel plan).
 */
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PlanConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AppConfirmModal
      visible={visible}
      onClose={onCancel}
      kicker="Agreement"
      title={title}
      message={message}
      iconVariant="danger"
      primaryLabel={cancelLabel}
      onPrimary={onCancel}
      secondaryLabel={confirmLabel}
      onSecondary={onConfirm}
      secondaryTone="danger"
      busyOn="secondary"
    />
  );
}
