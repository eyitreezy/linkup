/**
 * Inbox row — avatar-first (Tinder), rich preview (Hinge), airy layout (Bumble).
 */
import { Avatar } from '@/components/Avatar';
import { colors, spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ConversationCardProps = {
  name: string;
  avatarUrl: string | null;
  preview: string;
  timeLabel: string;
  unread: boolean;
  onPress: () => void;
};

export function ConversationCard({
  name,
  avatarUrl,
  preview,
  timeLabel,
  unread,
  onPress,
}: ConversationCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}>
      <View style={styles.row}>
        <Avatar uri={avatarUrl} name={name} size={56} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.time}>{timeLabel}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={2}>
              {preview}
            </Text>
            {unread ? <View style={styles.dot} /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  pressPressed: { opacity: 0.92 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, minWidth: 0 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  time: { fontSize: 13, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  preview: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  previewUnread: { color: colors.text, fontWeight: '600' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
