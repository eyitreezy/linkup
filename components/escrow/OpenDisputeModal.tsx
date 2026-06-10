import { Button } from '@/components/Button';
import { GradientSelectionChip } from '@/components/ui/GradientSelectionChip';
import { colors, radius, spacing } from '@/constants/theme';
import { ESCROW_DISPUTE_REASONS } from '@/lib/escrow/disputeReasons';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (reasonId: string, reasonLabel: string, detail: string) => void;
};

const FIELD_BORDER = '#D8DCE6';

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
          <View style={styles.handle} />

          <LinearGradient
            colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.06)', 'transparent']}
            style={styles.topGlow}
          />

          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Open a dispute</Text>
              <Text style={styles.sub}>
                Funds stay on hold while our team reviews. A support ticket is created automatically.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>What happened?</Text>
          <View style={styles.chips}>
            {ESCROW_DISPUTE_REASONS.map((r) => (
              <GradientSelectionChip
                key={r.id}
                label={r.label}
                selected={reasonId === r.id}
                onPress={() => setReasonId(r.id)}
                compact
              />
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
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textMuted, lineHeight: 21, fontWeight: '600' },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.authInputBg,
    marginBottom: spacing.lg,
  },
});
