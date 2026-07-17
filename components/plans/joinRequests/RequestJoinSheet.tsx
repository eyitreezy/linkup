import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import type { DbPlan } from '@/types/database';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  plan: DbPlan;
  message: string;
  onChangeMessage: (text: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export function RequestJoinSheet({
  visible,
  plan,
  message,
  onChangeMessage,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const slotLabel = resolveJoinRequestSlotCentsLabel(plan);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Request to join</Text>
          <Text style={styles.subtitle}>
            {slotLabel
              ? `Your slot will be ${slotLabel} if approved.`
              : 'The host will review your request at the formula share price.'}
          </Text>
          <Input
            label="Message (optional)"
            variant="onboardingFlat"
            value={message}
            onChangeText={onChangeMessage}
            placeholder="Add a short note for the host"
            multiline
            maxLength={200}
          />
          <Button
            title="Send request"
            gradient
            pill
            fullWidth
            loading={submitting}
            onPress={onSubmit}
            style={styles.cta}
          />
          <Button title="Cancel" variant="ghost" onPress={onClose} style={styles.cancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  cta: { marginTop: spacing.md },
  cancel: { marginTop: spacing.sm },
});
