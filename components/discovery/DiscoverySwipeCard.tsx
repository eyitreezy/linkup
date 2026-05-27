/**
 * Full-bleed discovery card — Tinder-style hero + Hinge-style copy.
 */
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { colors, radius, spacing } from '@/constants/theme';
import { planIntentTag } from '@/lib/discovery/planIntentTag';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { isUserVerified } from '@/lib/verification/access';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const urls = row.creatorProfile?.photo_urls;
  if (Array.isArray(urls) && urls.length > 0) return urls[0] ?? null;
  return row.creatorProfile?.avatar_url ?? null;
}

type Props = {
  row: PlanFeedRow;
  distanceKm: number | null;
  onPress: () => void;
};

function DiscoverySwipeCardInner({ row, distanceKm, onPress }: Props) {
  const name = row.creatorProfile?.display_name?.trim() || 'Member';
  const verified =
    !!row.creatorProfile?.verified_badge || isUserVerified(row.creatorVerification ?? undefined);
  const age = ageFromBirthDate(row.creatorProfile?.birth_date ?? null);
  const hero = heroUri(row);
  const intent = useMemo(() => planIntentTag(row), [row]);
  const when = formatPlanWhen(row);
  const caption = row.description?.trim() || row.title;

  const meetLabel = row.meetType?.name?.trim() || null;
  const tierBadge = row.is_paid ? budgetTierLabel(row.budget_tier) : null;
  const escrowBadge = row.is_paid ? escrowPatternBadge(row.escrow_pattern) : null;
  const { showMood, urgencyLabel, moodTypeLabel, moodExpiresAt } = useMemo(
    () => moodDiscoverMeta(row),
    [row]
  );
  const boosted = isPlanBoostActive(row.boosted_until);

  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={`${name}, ${intent.label}`}>
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
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)']}
        locations={[0, 0.45, 1]}
        style={styles.gradient}
      />
      <View style={styles.topRow}>
        <View style={styles.topLeftCol}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.intentPill}
          >
            <Text style={styles.intentEmoji}>{intent.emoji}</Text>
            <Text style={styles.intentTxt}>{intent.label}</Text>
          </LinearGradient>
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
            {meetLabel ? (
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeTxt}>{meetLabel}</Text>
              </View>
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
            {showMood && moodExpiresAt ? (
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
            {!row.is_paid ? (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeTxt}>Free to join</Text>
              </View>
            ) : null}
          </View>
        </View>
        <VerificationBadge verified={verified} variant="hero" />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
          {age != null ? <Text style={styles.age}> · {age}</Text> : null}
        </Text>
        <Text style={styles.dist} numberOfLines={1}>
          {distanceKm != null
            ? distanceKm < 1
              ? 'Near you'
              : `${distanceKm.toFixed(1)} km away`
            : 'Nearby'}
          {when ? ` · ${when}` : ''}
        </Text>
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

export const DiscoverySwipeCard = memo(DiscoverySwipeCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
    height: '100%',
    width: '100%',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  topLeftCol: { flex: 1, maxWidth: '78%', gap: 8 },
  badgeStack: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  moodEmoji: { fontSize: 12 },
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
  freeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(40,180,120,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,220,0.5)',
  },
  freeBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  intentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 6,
    elevation: 6,
  },
  intentEmoji: { fontSize: 15 },
  intentTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.lg,
  },
  name: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  age: { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  dist: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  caption: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
});
