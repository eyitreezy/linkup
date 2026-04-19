/**
 * Bottom-sheet style message actions (copy, edit, delete) — consistent on iOS and Android.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type MessageActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: MessageActionItem[];
};

export function MessageActionsSheet({ visible, onClose, title = 'Actions', actions }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
        >
          <View style={[styles.handleBar, !title && styles.handleBarTight]} accessibilityRole="none" />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <View style={styles.card}>
            {actions.map((a, i) => (
              <Pressable
                key={a.key}
                onPress={() => {
                  onClose();
                  requestAnimationFrame(() => a.onPress());
                }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowBorder,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={[styles.iconWrap, a.destructive && styles.iconWrapDanger]}>
                  <Ionicons
                    name={a.icon}
                    size={22}
                    color={a.destructive ? colors.danger : colors.primary}
                  />
                </View>
                <Text style={[styles.rowLabel, a.destructive && styles.rowLabelDanger]}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancelPill, pressed && styles.cancelPillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 29, 38, 0.48)',
  },
  sheet: {
    paddingHorizontal: spacing.md,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  handleBarTight: { marginBottom: spacing.sm },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  chevron: { opacity: 0.45 },
  cancelPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelPillPressed: {
    opacity: 0.88,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
