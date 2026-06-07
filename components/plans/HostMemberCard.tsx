import { Avatar } from '@/components/Avatar';
import { PlanningTogetherLocationChip } from '@/components/plans/PlanningTogetherLocationChip';
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { colors, radius, spacing } from '@/constants/theme';
import { resolveProfileHeroPhoto } from '@/lib/profile/displayMedia';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
  primaryPhotoUrl?: string | null;
  photoUrls?: string[] | null;
  verified?: boolean | null;
  roleLabel: string;
  locationLabel?: string | null;
  locationPrefix?: string;
  onPress: () => void;
};

export function HostMemberCard({
  displayName,
  avatarUrl,
  primaryPhotoUrl,
  photoUrls,
  verified,
  roleLabel,
  locationLabel,
  locationPrefix = 'Host location',
  onPress,
}: Props) {
  const hero = resolveProfileHeroPhoto({
    avatar_url: avatarUrl ?? null,
    primary_photo_url: primaryPhotoUrl ?? null,
    photo_urls: photoUrls ?? null,
  });
  const name = displayName?.trim() || 'Member';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${name} profile`}
      onPress={onPress}
      android_ripple={{ color: 'rgba(108,99,255,0.18)' }}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['rgba(108,99,255,0.1)', 'rgba(255,101,132,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Avatar uri={hero} name={name} size={56} />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {verified ? <VerificationBadge verified variant="chip" /> : null}
          </View>
          <Text style={styles.role}>{roleLabel}</Text>
          {locationLabel ? (
            <PlanningTogetherLocationChip prefix={locationPrefix} location={locationLabel} />
          ) : null}
          <View style={styles.ctaRow}>
            <Ionicons name="person-circle-outline" size={14} color={colors.primary} />
            <Text style={styles.ctaTxt}>View member profile</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.16)',
    backgroundColor: colors.surface,
  },
  meta: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  role: { fontSize: 13, fontWeight: '700', color: colors.secondary, marginTop: 2 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.1)',
  },
  ctaTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
});
