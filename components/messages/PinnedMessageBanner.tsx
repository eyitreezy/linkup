import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  preview: string;
  senderLabel: string;
  onPress: () => void;
  onUnpin: () => void;
};

/** WhatsApp-style pinned message strip at the top of a thread. */
export function PinnedMessageBanner({ preview, senderLabel, onPress, onUnpin }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Pinned message from ${senderLabel}. ${preview}`}
    >
      <View style={styles.accent} />
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Ionicons name="pin" size={14} color={colors.primary} />
          <Text style={styles.title}>Pinned message</Text>
        </View>
        <Text style={styles.sender} numberOfLines={1}>
          {senderLabel}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          onUnpin();
        }}
        hitSlop={10}
        style={({ pressed }) => [styles.unpinBtn, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel="Unpin message"
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  wrapPressed: { opacity: 0.92 },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  textCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  title: { fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  sender: { fontSize: 12, fontWeight: '800', color: colors.text, marginBottom: 2 },
  preview: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 17 },
  unpinBtn: { padding: 4 },
});
