/**
 * Confirm archive / delete / expire — shared AppConfirmModal shell.
 */
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  /** Safe/default action (primary gradient). */
  cancelLabel: string;
  /** Confirmed action (secondary). */
  confirmLabel: string;
  confirmVariant?: 'neutral' | 'danger';
  kicker?: string;
  iconVariant?: 'default' | 'warning' | 'danger';
};

export function PlanShelfActionConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmVariant = 'neutral',
  kicker = 'Your plans',
  iconVariant = 'warning',
}: Props) {
  return (
    <AppConfirmModal
      visible={visible}
      onClose={onClose}
      kicker={kicker}
      title={title}
      message={message}
      iconVariant={confirmVariant === 'danger' ? 'danger' : iconVariant}
      primaryLabel={cancelLabel}
      onPrimary={onClose}
      busyOn="secondary"
      secondaryLabel={confirmLabel}
      onSecondary={async () => {
        await Promise.resolve(onConfirm());
        onClose();
      }}
      secondaryTone={confirmVariant === 'danger' ? 'danger' : 'neutral'}
    />
  );
}
