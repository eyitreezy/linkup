/**
 * Full-bleed discovery card — profile-first, fast scanning.
 */
import { TierBadge } from '@/components/TierBadge';
import { HostPresenceChip } from '@/components/presence/HostPresenceChip';
import type { PresenceUi } from '@/lib/presence/derivePresenceUi';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { colors, radius, spacing } from '@/constants/theme';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { resolveProfileHeroPhoto } from '@/lib/profile/displayMedia';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age >= 18 && age < 120 ? age : null;
}

function budgetTierLabel(tier: PlanFeedRow['budget_tier']): string | null {
  if (!tier) return null;
  if (tier === 'low') return 'Budget · easy';
  if (tier === 'mid') return 'Budget · comfy';
  return 'Budget · premium';
}

function escrowPatternBadge(pattern: PlanFeedRow['escrow_pattern']): string | null {
  if (!pattern) return null;
  if (pattern === 'A') return 'Escrow · host pays';
  if (pattern === 'B') return 'Escrow · split';
  return 'Escrow · guest pays';
}

function heroUri(row: PlanFeedRow): string | null {
  return resolveProfileHeroPhoto(row.creatorProfile ?? null);
}

type Props = {
  row: PlanFeedRow;
  distanceKm: number | null;
  presence?: PresenceUi | null;
  onPress: () => void;
};

function DiscoverySwipeCardInner({ row, distanceKm, presence, onPress }: Props) {
  const name = row.creatorProfile?.display_name?.trim() || 'Member';
  const age = ageFromBirthDate(row.creatorProfile?.birth_date ?? null);
  const hero = heroUri(row);
  const when = formatPlanWhen(row);
  const caption = row.description?.trim() || row.title;
  const showTiming = !row.is_mood_plan;

  const tierBadge = row.is_paid ? budgetTierLabel(row.budget_tier) : null;
  const escrowBadge = row.is_paid ? escrowPatternBadge(row.escrow_pattern) : null;
  const { showMood, urgencyLabel, moodTypeLabel, moodExpiresAt } = useMemo(
    () => moodDiscoverMeta(row),
    [row]
  );
  const boosted = isPlanBoostActive(row.boosted_until);

  const distLine = useMemo(() => {
    const dist =
      distanceKm != null
        ? distanceKm < 1
          ? 'Near you'
          : `${distanceKm.toFixed(1)} km away`
        : 'Nearby';
    return showTiming && when ? `${dist} · ${when}` : dist;
  }, [distanceKm, showTiming, when]);

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${row.title}`}
    >
      {hero ? (
        <Image
          source={{ uri: hero }}
          style={styles.hero}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          priority="high"
        />
      ) : (
        <View style={styles.heroPh}>
          <Ionicons name="person-outline" size={48} color={colors.textMuted} />
        </View>
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.84)']}
        locations={[0, 0.48, 1]}
        style={styles.gradient}
      />
      <View style={styles.topRow}>
        <View style={styles.badgeStack}>
          {boosted ? (
            <LinearGradient
              colors={[colors.secondary, '#ff8ba0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.boostBadge}
            >
              <Ionicons name="flash" size={12} color="#fff" />
              <Text style={styles.boostBadgeTxt}>Boosted</Text>
            </LinearGradient>
          ) : null}
          {showMood && urgencyLabel ? (
            <View style={styles.urgencyBadge}>
              <Text style={styles.urgencyTxt}>{urgencyLabel}</Text>
            </View>
          ) : null}
          {showMood && moodTypeLabel ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeTxt} numberOfLines={1}>
                {moodTypeLabel}
              </Text>
            </View>
          ) : null}
          {showTiming && showMood && moodExpiresAt ? (
            <View style={styles.moodBadge}>
              <Ionicons name="hourglass-outline" size={12} color="#fff" />
              <MoodPlanCountdown expiresAtIso={moodExpiresAt} tone="onDark" />
            </View>
          ) : null}
          {tierBadge ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeTxt}>{tierBadge}</Text>
            </View>
          ) : null}
          {escrowBadge ? (
            <View style={styles.trustBadge}>
              <Text style={styles.trustBadgeTxt}>{escrowBadge}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.planTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
            {age != null ? <Text style={styles.age}> · {age}</Text> : null}
          </Text>
          {row.creatorProfile?.subscription_badge ? (
            <TierBadge tier={row.creatorProfile.subscription_badge} compact />
          ) : null}
          <HostPresenceChip presence={presence ?? null} variant="onDark" />
        </View>
        <Text style={styles.dist} numberOfLines={1}>
          {distLine}
        </Text>
        {caption !== row.title ? (
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const DiscoverySwipeCard = memo(DiscoverySwipeCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
    height: '100%',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.24,
        shadowRadius: 24,
      },
      android: { elevation: 14 },
    }),
  },
  hero: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroPh: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2d2d3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeStack: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: '100%' },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  boostBadgeTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  metaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  metaBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,220,80,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,245,200,0.85)',
  },
  urgencyTxt: { fontSize: 11, fontWeight: '900', color: '#fff' },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,90,60,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,180,0.85)',
  },
  trustBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(70,110,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(200,210,255,0.55)',
  },
  trustBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.lg + 4,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  age: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  dist: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
