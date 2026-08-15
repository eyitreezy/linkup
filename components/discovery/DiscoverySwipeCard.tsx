/**
 * Full-bleed discovery card — profile-first, fast scanning.
 */
import { CreatorSpotlightChip } from '@/components/plans/CreatorSpotlightChip';
import { HostMediaCarousel } from '@/components/plans/HostMediaCarousel';
import { TierBadge } from '@/components/TierBadge';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import { HostPresenceChip } from '@/components/presence/HostPresenceChip';
import type { PresenceUi } from '@/lib/presence/derivePresenceUi';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import { PlanTypeBadge } from '@/components/plans/PlanTypeBadge';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { planTypeBadges } from '@/lib/plans/planTypeIndicators';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { formatPlanDistanceLabel, planHasMeetupCoords } from '@/lib/plans/planDistanceLabel';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { buildHostMediaSequence } from '@/lib/profile/media/buildHostMediaSequence';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

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

type Props = {
  row: PlanFeedRow;
  distanceKm: number | null;
  viewerHasLocation?: boolean;
  presence?: PresenceUi | null;
  onPress: () => void;
  /** False for the stacked card behind the active swipe card. */
  interactive?: boolean;
  /** Subtle image parallax while the deck card is dragged. */
  mediaParallaxStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
};

function DiscoverySwipeCardInner({
  row,
  distanceKm,
  viewerHasLocation = true,
  presence,
  onPress,
  interactive = true,
  mediaParallaxStyle,
}: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const name = row.creatorProfile?.display_name?.trim() || 'Member';
  const age = ageFromBirthDate(row.creatorProfile?.birth_date ?? null);
  const when = formatPlanWhen(row);
  const caption = row.description?.trim() || row.title;
  const showTiming = !row.is_mood_plan;

  const mediaItems = useMemo(
    () => buildHostMediaSequence(row.creatorProfile, row.creatorIntroVideo),
    [row.creatorProfile, row.creatorIntroVideo]
  );
  const hasMultipleMedia = mediaItems.length > 1;

  const tierBadge = row.is_paid ? budgetTierLabel(row.budget_tier) : null;
  const escrowBadge = row.is_paid ? escrowPatternBadge(row.escrow_pattern) : null;
  const { showMood, moodExpiresAt } = useMemo(() => moodDiscoverMeta(row), [row]);
  const typeBadges = useMemo(() => planTypeBadges(row), [row]);
  const boosted = isPlanBoostActive(row.boosted_until);
  const creatorSpotlighted = isCreatorSpotlightActive(row.creatorProfile?.spotlight_until);

  const distLine = useMemo(() => {
    const dist = formatPlanDistanceLabel({
      distanceKm,
      viewerHasLocation,
      planHasLocation: planHasMeetupCoords(row),
      style: 'line',
    });
    return showTiming && when ? `${dist} · ${when}` : dist;
  }, [distanceKm, viewerHasLocation, row, showTiming, when]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  };

  return (
    <View
      style={styles.card}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${row.title}`}
    >
      <Animated.View style={[styles.mediaShell, mediaParallaxStyle]}>
        <HostMediaCarousel
          key={row.id}
          items={mediaItems}
          width={layout.width}
          height={layout.height}
          onCenterPress={interactive ? onPress : undefined}
          showCounter={false}
          previewOnly={!interactive}
          interactive={interactive}
          slideHaptics={interactive}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.84)']}
        locations={[0, 0.48, 1]}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View
        style={[styles.topRow, hasMultipleMedia && interactive && styles.topRowBelowSegments]}
        pointerEvents="none"
      >
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
          {typeBadges.map((badge) => (
            <PlanTypeBadge key={badge.key} badge={badge} variant="swipe" />
          ))}
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
      <View style={styles.bottom} pointerEvents="none">
        <Text style={styles.planTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
            {age != null ? <Text style={styles.age}> · {age}</Text> : null}
          </Text>
          {!boosted && creatorSpotlighted ? (
            <CreatorSpotlightChip variant="onDark" />
          ) : null}
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
    </View>
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
  mediaShell: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
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
  topRowBelowSegments: {
    top: spacing.md + 14,
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
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  groupBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94,82,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  groupBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: 0.2,
  },
  metaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  metaBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,220,80,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,245,200,0.85)',
  },
  urgencyTxt: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
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
  trustBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
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
    fontFamily: fonts.bold,
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
  name: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  age: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.medium,
  },
  dist: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
    fontFamily: fonts.medium,
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
