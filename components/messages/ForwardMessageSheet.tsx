import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { colors, radius, spacing } from '@/constants/theme';
import type { ForwardTarget } from '@/lib/messaging/fetchForwardTargets';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  loading: boolean;
  targets: ForwardTarget[];
  busyId: string | null;
  onClose: () => void;
  onSelect: (target: ForwardTarget) => void;
};

export function ForwardMessageSheet({
  visible,
  loading,
  targets,
  busyId,
  onClose,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
          <View style={styles.handleBar} />
          <Text style={styles.title}>Forward to</Text>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : targets.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No other conversations yet.</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              <View style={styles.card}>
                {targets.map((t, i) => {
                  const busy = busyId === t.conversationId;
                  return (
                    <Pressable
                      key={t.conversationId}
                      disabled={!!busyId}
                      onPress={() => onSelect(t)}
                      style={({ pressed }) => [
                        styles.row,
                        i > 0 && styles.rowBorder,
                        pressed && !busyId && styles.rowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Forward to ${t.name}`}
                    >
                      <AvatarWithPresence
                        uri={t.avatarUrl}
                        name={t.name}
                        size={44}
                        presence={null}
                        showDot={false}
                      />
                      <View style={styles.nameCol}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name} numberOfLines={1}>
                            {t.name}
                          </Text>
                          {t.verified ? (
                            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          ) : null}
                        </View>
                      </View>
                      {busy ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Ionicons name="arrow-redo-outline" size={20} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
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
    maxHeight: '72%',
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  list: { maxHeight: 360 },
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
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.background },
  nameCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  cancelPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelPillPressed: { opacity: 0.88 },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
});
