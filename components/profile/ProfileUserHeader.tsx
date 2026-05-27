import { PremiumBadge } from '@/components/profile/PremiumBadge';
import { colors, radius, spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  avatarUrl: string | null;
  email?: string | null;
  verified: boolean;
  /** Presence / visibility summary for own profile. */
  activityHint?: string | null;
  showPremium?: boolean;
  /** Opens notifications & visibility (optional). */
  onPressVisibilityHint?: () => void;
};

const AVATAR = 80;

export function ProfileUserHeader({
  name,
  avatarUrl,
  email,
  verified,
  activityHint,
  showPremium,
  onPressVisibilityHint,
}: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.primary, '#8B7CE8', colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatarRing}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.avatarImg, styles.ph]}>
            <Text style={styles.phTxt}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        {email ? (
          <View style={styles.emailRow}>
            <Ionicons name="mail-outline" size={15} color={colors.textMuted} style={styles.emailIcon} />
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          </View>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={[styles.badge, verified ? styles.badgeOn : styles.badgeOff]}>
            <Ionicons
              name={verified ? 'shield-checkmark' : 'shield-outline'}
              size={15}
              color={verified ? colors.success : colors.textMuted}
            />
            <Text style={[styles.badgeTxt, verified ? styles.badgeTxtOn : styles.badgeTxtOff]}>
              {verified ? 'Verified' : 'Not verified'}
            </Text>
          </View>
          {showPremium ? (
            <View style={styles.premiumSlot}>
              <PremiumBadge active />
            </View>
          ) : null}
        </View>

        {activityHint ? (
          onPressVisibilityHint ? (
            <Pressable
              onPress={onPressVisibilityHint}
              style={({ pressed }) => [styles.hintBox, pressed && styles.hintPressed]}
              accessibilityRole="button"
              accessibilityLabel="Notifications and visibility settings"
            >
              <View style={styles.hintIconWrap}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.hintTxt}>{activityHint}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.hintBoxStatic}>
              <View style={styles.hintIconWrap}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.hintTxt}>{activityHint}</Text>
            </View>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatarRing: {
    width: AVATAR + 6,
    height: AVATAR + 6,
    borderRadius: (AVATAR + 6) / 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.surface,
  },
  ph: { alignItems: 'center', justifyContent: 'center' },
  phTxt: { fontSize: 30, fontWeight: '900', color: colors.textMuted },
  meta: { flex: 1, minWidth: 0, paddingTop: 2 },
  name: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.45,
    lineHeight: 30,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
    minWidth: 0,
  },
  emailIcon: { marginTop: 1 },
  email: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  premiumSlot: { alignSelf: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.button,
  },
  badgeOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  badgeOff: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(26, 29, 38, 0.1)',
  },
  badgeTxt: { fontSize: 13, fontWeight: '800' },
  badgeTxtOn: { color: colors.success },
  badgeTxtOff: { color: colors.textMuted },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  hintBoxStatic: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  hintPressed: { opacity: 0.92 },
  hintIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  hintTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
});
