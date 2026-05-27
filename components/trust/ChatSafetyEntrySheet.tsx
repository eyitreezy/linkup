/**
 * Chat header entry: report user vs plan dispute (Badoo-style bottom sheet).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onReportUser: () => void;
  onPlanDispute: () => void;
  canPlanDispute: boolean;
};

export function ChatSafetyEntrySheet({
  visible,
  onClose,
  onReportUser,
  onPlanDispute,
  canPlanDispute,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Safety</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Choose the option that fits. Plan issues (payment, no-show, scams) go through a short video step so we can
          review fairly.
        </Text>
        <Pressable
          style={styles.row}
          onPress={() => {
            onClose();
            onReportUser();
          }}
          accessibilityRole="button"
        >
          <Ionicons name="person-remove-outline" size={22} color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Report this person</Text>
            <Text style={styles.rowSub}>Harassment, fake profile, or other behavior.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          style={[styles.row, !canPlanDispute && styles.rowDisabled]}
          onPress={() => {
            if (!canPlanDispute) return;
            onClose();
            onPlanDispute();
          }}
          disabled={!canPlanDispute}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPlanDispute }}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Report an issue with the plan</Text>
            <Text style={styles.rowSub}>
              {canPlanDispute
                ? 'Payment problems, no-show, misconduct, scams — includes a short clip.'
                : 'Available when you have an active or completed shared plan with this chat.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 29, 38, 0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 29, 38, 0.12)',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  hint: { fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  rowDisabled: { opacity: 0.55 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
});
