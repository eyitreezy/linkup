import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { ESCROW_DISPUTE_REASONS } from '@/lib/escrow/disputeReasons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (reasonId: string, reasonLabel: string, detail: string) => void;
};

export function OpenDisputeModal({ visible, loading, onClose, onSubmit }: Props) {
  const [reasonId, setReasonId] = useState<string>(ESCROW_DISPUTE_REASONS[0]?.id ?? 'other');
  const [detail, setDetail] = useState('');

  function submit() {
    const label = ESCROW_DISPUTE_REASONS.find((r) => r.id === reasonId)?.label ?? 'Other';
    onSubmit(reasonId, label, detail);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Open a dispute</Text>
          <Text style={styles.sub}>
            We&apos;ll hold funds while our team reviews. A support ticket is created automatically.
          </Text>
          <Text style={styles.label}>What happened?</Text>
          <View style={styles.chips}>
            {ESCROW_DISPUTE_REASONS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReasonId(r.id)}
                style={[styles.chip, reasonId === r.id && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, reasonId === r.id && styles.chipTxtOn]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Tell us more (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add context — helps us resolve faster."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            value={detail}
            onChangeText={setDetail}
            textAlignVertical="top"
          />
          <Button title="Submit dispute" onPress={submit} loading={loading} />
          <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  sub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: '#EEF2FF', borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTxtOn: { color: colors.primary },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
  },
});
