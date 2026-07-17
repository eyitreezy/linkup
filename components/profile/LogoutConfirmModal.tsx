/**
 * Logout confirmation — inbox-grade gradient shell + dual CTAs.
 */
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

const BODY =
  'Sign in again to access your inbox and plans. Your account stays saved.';

export function LogoutConfirmModal({ visible, onClose, onConfirm }: Props) {
  return (
    <AppConfirmModal
      visible={visible}
      onClose={onClose}
      kicker="Account"
      title="Log out?"
      message={BODY}
      iconVariant="logout"
      primaryLabel="Stay signed in"
      onPrimary={onClose}
      busyOn="secondary"
      secondaryLabel="Log out"
      onSecondary={async () => {
        await Promise.resolve(onConfirm());
        onClose();
      }}
      secondaryTone="danger"
    />
  );
}
