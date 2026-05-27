import { colors, radius, spacing } from '@/constants/theme';
import { notificationIcon } from '@/lib/notifications/notificationIcon';
import type { DbNotification } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

type Props = {
  item: DbNotification;
  index: number;
  onPress: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationSwipeRow({ item, index, onPress, onMarkRead, onDelete }: Props) {
  const icon = notificationIcon(item.type);
  const priorityDot =
    item.priority === 'high' ? colors.danger : item.priority === 'medium' ? colors.primary : colors.textMuted;

  return (
    <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: Math.min(index * 40, 400) }}>
      <Swipeable
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={() => (
          <Pressable style={styles.leftAction} onPress={onMarkRead} accessibilityRole="button" accessibilityLabel="Mark as read">
            <Ionicons name="checkmark-done" size={22} color="#fff" />
            <Text style={styles.actionTxt}>Read</Text>
          </Pressable>
        )}
        renderRightActions={() => (
          <Pressable style={styles.rightAction} onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete notification">
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.actionTxt}>Delete</Text>
          </Pressable>
        )}
      >
        <Pressable style={styles.card} onPress={onPress}>
          <View style={[styles.iconWrap, { borderColor: priorityDot }]}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {!item.is_read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.body} numberOfLines={3}>
              {item.body}
            </Text>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Swipeable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
  },
  rightAction: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: radius.button,
    marginLeft: spacing.sm,
  },
  actionTxt: { color: '#fff', fontWeight: '700', fontSize: 12, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  textCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 4 },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
});
