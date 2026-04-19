/**
 * Logout confirmation — same visual language as VerificationHardGateModal
 * (Tinder-tight title, Hinge-style trust copy, Bumble pill CTAs).
 */
import { Button } from '@/components/Button';
import { kycColors, kycShadow, kycStyles } from '@/components/kyc/kycTheme';
import { spacing } from '@/constants/theme';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

const BODY =
  "You'll need to sign in again to open your inbox, plans, and profile. Your account stays right where you left it — we never delete anything just because you signed out.";

export function LogoutConfirmModal({ visible, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onConfirm());
      onClose();
    } finally {
      setBusy(false);
    }
  }, [busy, onConfirm, onClose]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} disabled={busy}>
        <Pressable style={[kycStyles.card, styles.card]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Log out?</Text>
          <Text style={styles.body}>{BODY}</Text>
          <View style={styles.actions}>
            <Button title="Stay signed in" onPress={onClose} pill disabled={busy} />
            <Button
              title="Log out"
              variant="ghost"
              onPress={() => void handleConfirm()}
              style={{ marginTop: spacing.sm }}
              loading={busy}
              disabled={busy}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    ...kycShadow,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: kycColors.text,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 15,
    color: kycColors.muted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actions: {
    marginTop: 'auto',
  },
});
