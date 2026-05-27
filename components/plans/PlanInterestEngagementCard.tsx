/**
 * Premium plan interest row — inbox / notification card polish.
 */
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing } from '@/constants/theme';
import { formatRelativeShort } from '@/lib/messaging/formatRelative';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  avatarUrl: string | null;
  kind: 'save' | 'view' | string;
  createdAt: string;
  onPress: () => void;
};

export function PlanInterestEngagementCard({ name, avatarUrl, kind, createdAt, onPress }: Props) {
  const isSave = kind === 'save';
  const kindLabel = isSave ? 'Saved' : 'Viewed';
  const timeLabel = formatRelativeShort(createdAt);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${kindLabel} ${timeLabel}`}
    >
      <View style={[styles.card, isSave && styles.cardSave]}>
        {isSave ? (
          <LinearGradient
            colors={[colors.secondary, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.saveStripe}
          />
        ) : null}
        <View style={styles.row}>
          <LinearGradient
            colors={
              isSave
                ? ['rgba(255,101,132,0.35)', 'rgba(108,99,255,0.28)']
                : ['rgba(108,99,255,0.22)', 'rgba(255,101,132,0.14)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              <Avatar uri={avatarUrl} name={name} size={52} />
            </View>
          </LinearGradient>
          <View style={styles.body}>
            <View style={styles.topLine}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.time}>{timeLabel}</Text>
            </View>
            <View style={styles.kindRow}>
              <View style={[styles.kindPill, isSave && styles.kindPillSave]}>
                <Ionicons
                  name={isSave ? 'bookmark' : 'eye-outline'}
                  size={13}
                  color={isSave ? colors.secondary : colors.primary}
                />
                <Text style={[styles.kindTxt, isSave && styles.kindTxtSave]}>{kindLabel}</Text>
              </View>
              <Text style={styles.sub} numberOfLines={1}>
                {isSave ? 'Added your plan to their list' : 'Checked out your meetup'}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isSave ? colors.secondary : colors.textMuted}
            style={styles.chevron}
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
    paddingLeft: spacing.md + 4,
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
  cardSave: {
    borderColor: 'rgba(255, 101, 132, 0.32)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    shadowColor: colors.secondary,
    shadowOpacity: 0.14,
  },
  saveStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  avatarRing: {
    borderRadius: 32,
    padding: 2,
  },
  avatarInner: {
    borderRadius: 30,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  body: { flex: 1, minWidth: 0 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.25,
  },
  time: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  kindRow: { gap: 4 },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  kindPillSave: {
    backgroundColor: 'rgba(255, 101, 132, 0.1)',
    borderColor: 'rgba(255, 101, 132, 0.22)',
  },
  kindTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kindTxtSave: { color: colors.secondary },
  sub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  chevron: { marginLeft: 2 },
});
