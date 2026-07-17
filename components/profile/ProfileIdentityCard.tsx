/**
 * Compact identity card — primary photo, tier, email, badges (linkup-web parity).
 */
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { resolveProfileHeroPhoto } from '@/lib/profile/displayMedia';
import type { DbProfile, SubscriptionTier } from '@/types/database';
import { Href, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  profile: DbProfile | null | undefined;
  name: string;
  email?: string | null;
  verified: boolean;
  subscriptionTier: SubscriptionTier;
  completionPercent: number;
};

export function ProfileIdentityCard({
  profile,
  name,
  email,
  verified,
  subscriptionTier,
  completionPercent,
}: Props) {
  const photo = resolveProfileHeroPhoto(profile ?? null);
  const showCompletion = completionPercent < 100;

  return (
    <LinearGradient
      colors={[colors.primary, '#8B7CFF', colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.shell}
    >
      <View style={styles.inner}>
        <View style={styles.row}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Text style={styles.thumbInitial}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.meta}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
              {subscriptionTier !== 'FREE' ? <TierBadge tier={subscriptionTier} /> : null}
            </View>

            {email ? (
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
            ) : null}

            <View style={styles.badgeRow}>
              <View style={[styles.badge, verified ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeTxt, verified ? styles.badgeTxtOn : styles.badgeTxtOff]}>
                  {verified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            </View>

            {showCompletion ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/settings/edit-profile' as Href)}
                style={({ pressed }) => [styles.completionRow, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={styles.completionTxt}>Profile · {completionPercent}% complete</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const THUMB = 56;

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  inner: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl - 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 74, 114, 0.28)',
    backgroundColor: colors.surface,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D2C9FF',
  },
  thumbInitial: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  meta: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: 28,
    flexShrink: 1,
  },
  email: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
  },
  badgeOn: { backgroundColor: 'rgba(94, 82, 255, 0.1)' },
  badgeOff: { backgroundColor: 'rgba(26, 29, 38, 0.06)' },
  badgeTxt: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
  },
  badgeTxtOn: { color: colors.primary },
  badgeTxtOff: { color: colors.textMuted },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(94, 82, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  completionTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
});
