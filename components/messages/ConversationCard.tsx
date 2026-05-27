/**
 * Inbox row — bold card, avatar-first layout, warm preview line.
 */
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ConversationCardProps = {
  name: string;
  avatarUrl: string | null;
  preview: string;
  timeLabel: string;
  unread: boolean;
  verified?: boolean;
  onPress: () => void;
};

const AVATAR = 58;

export function ConversationCard({
  name,
  avatarUrl,
  preview,
  timeLabel,
  unread,
  verified,
  onPress,
}: ConversationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${preview}`}
    >
      <View style={[styles.card, unread && styles.cardUnread]}>
        {unread ? (
          <LinearGradient
            colors={[colors.secondary, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.unreadStripe}
          />
        ) : null}
        <View style={styles.row}>
          <View style={[styles.avatarWrap, unread && styles.avatarWrapUnread]}>
            <Avatar uri={avatarUrl} name={name} size={AVATAR} />
          </View>
          <View style={styles.body}>
            <View style={styles.topLine}>
              <View style={styles.nameCluster}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {verified ? (
                  <Ionicons name="checkmark-circle" size={17} color={colors.primary} style={styles.verified} />
                ) : null}
              </View>
              <Text style={[styles.time, unread && styles.timeUnread]}>{timeLabel}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={2}>
                {preview}
              </Text>
              {unread ? <View style={styles.dot} /> : null}
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={unread ? colors.secondary : colors.textMuted}
            style={[styles.chevron, unread && styles.chevronHot]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pressPressed: { opacity: 0.96, transform: [{ scale: 0.992 }] },
  card: {
    position: 'relative',
    borderRadius: 22,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md + 6,
    paddingRight: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  unreadStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  cardUnread: {
    borderColor: 'rgba(255, 101, 132, 0.42)',
    backgroundColor: 'rgba(255, 255, 255, 0.99)',
    shadowColor: colors.secondary,
    shadowOpacity: 0.16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  avatarWrap: {
    borderRadius: radius.button,
  },
  avatarWrapUnread: {
    padding: 2,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  body: { flex: 1, minWidth: 0 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  nameCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  verified: { marginTop: 1 },
  time: { fontSize: 12, fontWeight: '700', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  timeUnread: { color: colors.secondary },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  preview: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.textMuted, fontWeight: '500' },
  previewUnread: { color: colors.text, fontWeight: '700' },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    marginTop: 7,
  },
  chevron: { opacity: 0.45 },
  chevronHot: { opacity: 0.95 },
});
