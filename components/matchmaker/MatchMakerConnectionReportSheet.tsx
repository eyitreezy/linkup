import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { colors } from '@/constants/theme';
import {
  MISALIGNMENT_REPORT_MAX_EXPLANATION,
  MISALIGNMENT_REPORT_REASONS,
  sanitizeMisalignmentExplanation,
  validateMisalignmentSubmission,
  type MisalignmentReportReasonCode,
} from '@/lib/matchmaker/misalignmentReport';
import { submitMatchMakerConnectionReport } from '@/lib/matchmaker/matchmakerApi';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  connectionId: string;
  onClose: () => void;
};

export function MatchMakerConnectionReportSheet({ visible, connectionId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [reason, setReason] = useState<MisalignmentReportReasonCode | null>(null);
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setExplanation('');
      setError(null);
      setDone(false);
      setBusy(false);
    }
  }, [visible]);

  function close() {
    onClose();
  }

  async function submit() {
    const check = validateMisalignmentSubmission(reason, explanation);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitMatchMakerConnectionReport({
        connectionId,
        reasonCode: reason!,
        explanation: explanation.trim() || null,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: insets.bottom + spacing.md }]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {done ? (
            <>
              <Text style={styles.title}>Your report has been received.</Text>
              <Button title="Close" onPress={close} gradient pill fullWidth style={{ marginTop: spacing.lg }} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Report a concern</Text>
              <Text style={styles.sub}>
                This is separate from blocking. Use this if you feel this connection is not being used with sincere
                intent.
              </Text>

              <Text style={styles.kicker}>Reason</Text>
              <ChoiceChipRow>
                {MISALIGNMENT_REPORT_REASONS.map((opt) => (
                  <ChoiceChip
                    key={opt.code}
                    label={opt.label}
                    selected={reason === opt.code}
                    onPress={() => {
                      setReason(opt.code);
                      setError(null);
                    }}
                  />
                ))}
              </ChoiceChipRow>

              <Text style={styles.kicker}>Optional details</Text>
              <Input
                value={explanation}
                onChangeText={(t) => setExplanation(sanitizeMisalignmentExplanation(t))}
                placeholder="Add context (optional)"
                multiline
                numberOfLines={3}
                variant="onboarding"
                maxLength={MISALIGNMENT_REPORT_MAX_EXPLANATION}
              />
              <Text style={styles.counter}>
                {explanation.length}/{MISALIGNMENT_REPORT_MAX_EXPLANATION}
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.row}>
                <Pressable onPress={close} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Button
                  title={busy ? 'Submitting…' : 'Submit report'}
                  onPress={() => void submit()}
                  loading={busy}
                  disabled={busy}
                  gradient
                  pill
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 29, 38, 0.45)' },
  sheet: {
    backgroundColor: MM.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: MM.border,
  },
  title: { fontSize: 20, fontFamily: fonts.bold, color: MM.text },
  sub: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: MM.muted,
    lineHeight: 20,
  },
  kicker: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  counter: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  error: { marginTop: spacing.sm, fontSize: 13, fontFamily: fonts.medium, color: '#EF4444' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MM.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MM.surface,
  },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: MM.text },
});
