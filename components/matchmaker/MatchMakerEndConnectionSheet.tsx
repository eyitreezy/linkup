import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { colors } from '@/constants/theme';
import {
  buildEndConnectionReasonForRpc,
  clampOtherReasonInput,
  END_CONNECTION_OTHER_LABEL,
  END_CONNECTION_OTHER_MAX_LENGTH,
  END_CONNECTION_REASON_OPTIONS,
  type EndConnectionReasonOption,
} from '@/lib/matchmaker/endConnectionReason';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  partnerName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function MatchMakerEndConnectionSheet({
  visible,
  partnerName,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [reason, setReason] = useState<EndConnectionReasonOption | null>(null);
  const [otherText, setOtherText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setOtherText('');
      setValidationError(null);
    }
  }, [visible]);

  const otherSelected = reason === END_CONNECTION_OTHER_LABEL;
  const otherCharCount = otherText.length;

  const canSubmit = useMemo(() => {
    if (!reason || busy) return false;
    if (otherSelected) return otherText.trim().length > 0;
    return true;
  }, [reason, busy, otherSelected, otherText]);

  function submitEnd() {
    const built = buildEndConnectionReasonForRpc(reason, otherText);
    if (!built.ok) {
      setValidationError(built.message);
      return;
    }
    setValidationError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(built.reason);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: height * 0.88, paddingBottom: insets.bottom + spacing.lg }]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.title}>End your connection with {partnerName}?</Text>
          <Text style={styles.body}>
            This cannot be undone. {partnerName} will be notified that this connection has ended. No reason will be
            shared with them.
          </Text>
          <ChoiceChipRow>
            {END_CONNECTION_REASON_OPTIONS.map((r) => (
              <ChoiceChip
                key={r}
                label={r}
                selected={reason === r}
                onPress={() => {
                  setReason(r);
                  setValidationError(null);
                  if (r !== END_CONNECTION_OTHER_LABEL) setOtherText('');
                }}
              />
            ))}
          </ChoiceChipRow>
          {otherSelected ? (
            <View style={styles.otherField}>
              <Input
                value={otherText}
                onChangeText={(t) => {
                  setOtherText(clampOtherReasonInput(t));
                  setValidationError(null);
                }}
                placeholder="Please enter your reason"
                maxLength={END_CONNECTION_OTHER_MAX_LENGTH}
                variant="onboarding"
                emojiAccessory={false}
                autoFocus
              />
              <Text style={styles.counter}>
                {otherCharCount}/{END_CONNECTION_OTHER_MAX_LENGTH}
              </Text>
            </View>
          ) : null}
          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          <Button
            title="End connection"
            onPress={submitEnd}
            loading={busy}
            disabled={!canSubmit}
            gradient
            pill
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
          <Button
            title="Go back, keep this connection"
            onPress={onClose}
            variant="ghost"
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 29, 38, 0.45)' },
  sheet: {
    backgroundColor: MM.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: MM.border,
  },
  title: { fontSize: 20, fontFamily: fonts.bold, color: MM.text },
  body: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: MM.muted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  otherField: { marginTop: spacing.md },
  counter: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'right',
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#DC2626',
  },
});
