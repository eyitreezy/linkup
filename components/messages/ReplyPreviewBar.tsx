import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  senderLabel: string;
  preview: string;
  onCancel: () => void;
};

export function ReplyPreviewBar({ senderLabel, preview, onCancel }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <View style={styles.textCol}>
        <Text style={styles.label} numberOfLines={1}>
          Replying to {senderLabel}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      </View>
      <Pressable
        onPress={onCancel}
        hitSlop={10}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.16)',
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  textCol: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  preview: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  closeBtn: { padding: 4 },
});
