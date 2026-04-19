import { Button } from '@/components/Button';
import { kycColors, kycShadow } from '@/components/kyc/kycTheme';
import { spacing } from '@/constants/theme';
import { clearSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * Non-blocking post-onboarding prompt — unlock plans, negotiation, escrow.
 */
export function SoftKycPrompt({ visible, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);

  async function skip() {
    setBusy(true);
    await clearSoftKycPromptPending();
    setBusy(false);
    onDismiss();
  }

  async function verify() {
    setBusy(true);
    await clearSoftKycPromptPending();
    setBusy(false);
    onDismiss();
    router.push('/kyc' as Href);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Unlock more with verification</Text>
          <Text style={styles.lead}>
            A quick check helps everyone trust who they&apos;re meeting — and unlocks paid features fairly.
          </Text>
          <View style={styles.bullets}>
            <View style={styles.row}>
              <Text style={styles.tick}>✔</Text>
              <Text style={styles.rowText}>Create plans</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.tick}>✔</Text>
              <Text style={styles.rowText}>Negotiate meetups</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.tick}>✔</Text>
              <Text style={styles.rowText}>Use secure escrow</Text>
            </View>
          </View>
          <Button title="Verify now" onPress={verify} loading={busy} pill />
          <Button
            title="Skip for now"
            variant="secondary"
            onPress={skip}
            disabled={busy}
            style={{ marginTop: spacing.sm }}
          />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: kycColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...kycShadow,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: kycColors.text,
    marginBottom: spacing.sm,
  },
  lead: { fontSize: 15, color: kycColors.muted, lineHeight: 22, marginBottom: spacing.md },
  bullets: { marginBottom: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  tick: { color: kycColors.primary, fontWeight: '800', width: 28, fontSize: 16 },
  rowText: { fontSize: 15, color: kycColors.text },
});
