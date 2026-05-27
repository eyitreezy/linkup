/**
 * Hybrid plan card — media-forward header, trust signals, quick actions.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { isUserVerified } from '@/lib/verification/access';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { derivePresenceUi } from '@/lib/presence/derivePresenceUi';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlanOffer, DbProfile, DbUserPresence } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  row: PlanFeedRow;
  distanceKm: number | null;
  currentUserId: string | undefined;
  /** Latest offer from the current user as bidder, if any. */
  userOffer?: DbPlanOffer | null;
  viewerProfile?: DbProfile | null;
  creatorPresence?: DbUserPresence | null;
  onPressCard: () => void;
  onPressAvatar: () => void;
  onPressOffer: () => void;
  /** Long-press card to hide from feed (Premium-style undo supported in feed header). */
  onDismissFromFeed?: () => void;
  /** Dating-app tone: softer CTAs, hide pricing on the card. */
  warmTone?: boolean;
  /** Hinge / Bumble–style list row: hero-first, gradient accents. */
  datingList?: boolean;
};

type OfferCta = {
  label: string;
  statusLabel?: string;
  icon: 'arrow' | 'time' | 'check';
  disabled: boolean;
  muted: boolean;
};

function planHeroUri(row: PlanFeedRow): string | null {
  const urls = row.creatorProfile?.photo_urls;
  if (Array.isArray(urls) && urls.length > 0) return urls[0] ?? null;
  return row.creatorProfile?.avatar_url ?? null;
}

function isProfileComplete(row: PlanFeedRow): boolean {
  const p = row.creatorProfile;
  if (!p) return false;
  return (
    p.onboarding_status === 'complete' &&
    !!p.display_name?.trim() &&
    !!p.avatar_url &&
    (p.bio?.trim().length ?? 0) >= 8
  );
}

function offerStatusDisplay(status: DbPlanOffer['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'countered':
      return 'Countered';
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    case 'superseded':
      return 'Superseded';
    default:
      return 'Pending';
  }
}

function deriveOfferCta(offer: DbPlanOffer | null | undefined, warmTone?: boolean): OfferCta {
  if (!offer) {
    return { label: warmTone ? 'Say hello' : 'Send offer', icon: 'arrow', disabled: false, muted: false };
  }
  const dead = isOfferExpired(offer);
  if (offer.status === 'accepted') {
    return {
      label: warmTone ? 'You’re aligned' : 'Accepted',
      icon: 'check',
      disabled: true,
      muted: true,
    };
  }
  if ((offer.status === 'pending' || offer.status === 'countered') && !dead) {
    if (offer.status === 'pending') {
      return {
        label: warmTone ? 'Suggestion sent' : 'Offer Sent',
        statusLabel: offerStatusDisplay('pending'),
        icon: 'time',
        disabled: true,
        muted: true,
      };
    }
    return {
      label: warmTone ? 'Keep chatting' : 'Continue',
      statusLabel: offerStatusDisplay('countered'),
      icon: 'arrow',
      disabled: false,
      muted: false,
    };
  }
  return { label: warmTone ? 'Say hello' : 'Send offer', icon: 'arrow', disabled: false, muted: false };
}

function PlanCardInner({
  row,
  distanceKm,
  currentUserId,
  userOffer,
  viewerProfile,
  creatorPresence,
  onPressCard,
  onPressAvatar,
  onPressOffer,
  onDismissFromFeed,
  warmTone = false,
  datingList = false,
}: Props) {
  const name = row.creatorProfile?.display_name?.trim() || 'Member';
  const hero = planHeroUri(row);
  const verified =
    !!row.creatorProfile?.verified_badge || isUserVerified(row.creatorVerification ?? undefined);
  const trustScore = row.creatorProfile?.ai_trust_score;
  const showTrustChip = typeof trustScore === 'number' && trustScore >= 0.72;
  const showProfileComplete = isProfileComplete(row);
  const isOwn = currentUserId != null && row.creator_id === currentUserId;
  const price = formatPlanPrice(row);
  const when = formatPlanWhen(row);
  const desc = row.description?.trim() ?? '';
  const boosted = isPlanBoostActive(row.boosted_until);
  const offerCta = useMemo(() => deriveOfferCta(userOffer ?? null, warmTone), [userOffer, warmTone]);
  const showCreatorPresence = !!userOffer && !isOwn;
  const presenceUi = useMemo(
    () =>
      showCreatorPresence
        ? derivePresenceUi(
            viewerProfile ?? null,
            row.creatorProfile?.preferences,
            creatorPresence ?? null
          )
        : null,
    [showCreatorPresence, viewerProfile, row.creatorProfile?.preferences, creatorPresence]
  );
  const moodMeta = useMemo(() => moodDiscoverMeta(row), [row]);

  const distLabel =
    distanceKm != null ? (distanceKm < 1 ? 'Near you' : `${distanceKm.toFixed(1)} km`) : 'Nearby';

  if (datingList) {
    return (
      <Pressable
        onPress={onPressCard}
        onLongPress={onDismissFromFeed}
        delayLongPress={onDismissFromFeed ? 450 : undefined}
        style={({ pressed }) => [styles.cardDating, pressed && styles.cardDatingPressed]}
        accessibilityRole="button"
        accessibilityHint={
          onDismissFromFeed ? 'View plan details. Long press to hide from this list.' : 'View plan details'
        }
      >
        <View style={styles.datingHeroWrap}>
          {hero ? (
            <Image source={{ uri: hero }} style={styles.datingHeroImg} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.datingHeroPh}>
              <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.7)" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            locations={[0.25, 1]}
            style={styles.datingHeroScrim}
          />
          <View style={styles.datingHeroOverlay}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.datingDistPill}
            >
              <Ionicons name="navigate-outline" size={14} color="#fff" />
              <Text style={styles.datingDistPillTxt}>{distLabel}</Text>
            </LinearGradient>
            <View style={styles.datingHeroRight}>
              {verified ? (
                <View style={styles.datingVerifiedPill}>
                  <Ionicons name="shield-checkmark" size={13} color="#fff" />
                  <Text style={styles.datingVerifiedPillTxt}>Verified</Text>
                </View>
              ) : null}
              {boosted ? (
                <LinearGradient
                  colors={[colors.secondary, '#ff8ba0']}
                  style={styles.datingBoostMini}
                >
                  <Ionicons name="flash" size={12} color="#fff" />
                </LinearGradient>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.datingBody}>
          <View style={styles.datingHostRow}>
            <Pressable
              onPress={onPressAvatar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${name} profile`}
            >
              <AvatarWithPresence
                uri={row.creatorProfile?.avatar_url}
                name={name}
                size={46}
                presence={presenceUi}
                showDot={showCreatorPresence}
              />
            </Pressable>
            <View style={styles.datingHostMeta}>
              <Text style={styles.datingHostName} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.datingChipRow}>
                {showTrustChip ? (
                  <View style={styles.datingTrustChip}>
                    <Text style={styles.datingTrustChipTxt}>Trusted</Text>
                  </View>
                ) : null}
                {showProfileComplete ? (
                  <View style={styles.datingProfileChip}>
                    <Ionicons name="checkmark-done" size={11} color="#059669" />
                    <Text style={styles.datingProfileChipTxt}>Solid profile</Text>
                  </View>
                ) : null}
                {moodMeta.showMood && moodMeta.urgencyLabel ? (
                  <View style={styles.datingMoodUrgent}>
                    <Text style={styles.datingMoodUrgentTxt}>{moodMeta.urgencyLabel}</Text>
                  </View>
                ) : null}
                {moodMeta.showMood && moodMeta.moodTypeLabel ? (
                  <View style={styles.datingMoodTypeChip}>
                    <Text style={styles.datingMoodTypeChipTxt} numberOfLines={1}>
                      {moodMeta.moodTypeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={styles.datingTitle} numberOfLines={2}>
            {row.title}
          </Text>
          {desc.length > 0 ? (
            <Text style={styles.datingDesc} numberOfLines={3}>
              {desc}
            </Text>
          ) : null}

          <View style={styles.datingMetaRow}>
            <View style={styles.datingMetaChip}>
              <Ionicons name="calendar-outline" size={15} color={colors.primary} />
              <Text style={styles.datingMetaChipTxt} numberOfLines={1}>
                {when}
              </Text>
            </View>
            {row.location_label ? (
              <View style={[styles.datingMetaChip, styles.datingMetaChipPink]}>
                <Ionicons name="location-outline" size={15} color={colors.secondary} />
                <Text style={styles.datingMetaChipTxt} numberOfLines={1}>
                  {row.location_label}
                </Text>
              </View>
            ) : null}
            {moodMeta.showMood && moodMeta.moodExpiresAt ? (
              <View style={[styles.datingMetaChip, styles.datingMoodTtlChip]}>
                <Ionicons name="hourglass-outline" size={15} color={colors.secondary} />
                <MoodPlanCountdown expiresAtIso={moodMeta.moodExpiresAt} />
              </View>
            ) : null}
          </View>

          {warmTone ? (
            <View style={styles.datingVibeHint}>
              <Ionicons name="heart" size={14} color={colors.secondary} />
              <Text style={styles.datingVibeHintTxt}>Open to ideas — details when you connect</Text>
            </View>
          ) : price ? (
            <View style={styles.datingMetaChip}>
              <Ionicons name="pricetag-outline" size={15} color={colors.primary} />
              <Text style={styles.datingMetaChipTxt}>{price}</Text>
            </View>
          ) : null}

          {!isOwn ? (
            <View style={styles.datingCtaWrap}>
              {offerCta.statusLabel ? (
                <Text style={styles.datingCtaHint} numberOfLines={1}>
                  {offerCta.statusLabel}
                </Text>
              ) : null}
              <Pressable
                onPress={offerCta.disabled ? undefined : onPressOffer}
                disabled={offerCta.disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: offerCta.disabled }}
                accessibilityLabel={offerCta.label}
              >
                {offerCta.muted ? (
                  <View style={styles.datingCtaMuted}>
                    {offerCta.icon === 'check' ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.textMuted} />
                    ) : offerCta.icon === 'time' ? (
                      <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                    ) : (
                      <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
                    )}
                    <Text style={styles.datingCtaMutedTxt}>{offerCta.label}</Text>
                  </View>
                ) : (
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.datingCtaGrad}
                  >
                    {offerCta.icon === 'check' ? (
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    ) : offerCta.icon === 'time' ? (
                      <Ionicons name="time-outline" size={18} color="#fff" />
                    ) : (
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                    )}
                    <Text style={styles.datingCtaGradTxt}>{offerCta.label}</Text>
                  </LinearGradient>
                )}
              </Pressable>
            </View>
          ) : null}
          {onDismissFromFeed && !isOwn ? (
            <Text style={styles.datingHideHint}>Long press card to hide from your feed</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPressCard}
      onLongPress={onDismissFromFeed}
      delayLongPress={onDismissFromFeed ? 450 : undefined}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityHint={
        onDismissFromFeed ? 'View plan details. Long press to hide from this list.' : 'View plan details'
      }
    >
      <View style={styles.top}>
        <Pressable onPress={onPressAvatar} hitSlop={8} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel={`${name} profile`}>
          <AvatarWithPresence
            uri={row.creatorProfile?.avatar_url}
            name={name}
            size={48}
            presence={presenceUi}
            showDot={showCreatorPresence}
          />
        </Pressable>
        <View style={styles.topMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {verified ? (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.badgeTxt}>Verified</Text>
              </View>
            ) : null}
            {showTrustChip ? (
              <View style={styles.trustChip}>
                <Text style={styles.trustChipTxt}>Trusted</Text>
              </View>
            ) : null}
            {showProfileComplete ? (
              <View style={styles.profileChip}>
                <Ionicons name="checkmark-done" size={12} color="#059669" />
                <Text style={styles.profileChipTxt}>Solid profile</Text>
              </View>
            ) : null}
          </View>
          {distanceKm != null ? (
            <Text style={styles.dist}>{distanceKm < 1 ? '< 1 km away' : `${distanceKm.toFixed(1)} km away`}</Text>
          ) : (
            <Text style={styles.dist}>Nearby</Text>
          )}
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.planTitle} numberOfLines={2}>
          {row.title}
        </Text>
        {boosted ? (
          <View style={styles.boostPill}>
            <Ionicons name="flash" size={12} color="#fff" />
            <Text style={styles.boostPillTxt}>Boosted</Text>
          </View>
        ) : null}
      </View>
      {moodMeta.showMood ? (
        <View style={styles.listMoodRow}>
          {moodMeta.urgencyLabel ? (
            <View style={styles.listMoodUrgent}>
              <Text style={styles.listMoodUrgentTxt}>{moodMeta.urgencyLabel}</Text>
            </View>
          ) : null}
          {moodMeta.moodTypeLabel ? (
            <View style={styles.listMoodType}>
              <Text style={styles.listMoodTypeTxt} numberOfLines={1}>
                {moodMeta.moodTypeLabel}
              </Text>
            </View>
          ) : null}
          {moodMeta.moodExpiresAt ? (
            <View style={styles.listMoodTtl}>
              <Ionicons name="hourglass-outline" size={12} color={colors.secondary} />
              <MoodPlanCountdown expiresAtIso={moodMeta.moodExpiresAt} />
            </View>
          ) : null}
        </View>
      ) : null}
      {desc.length > 0 ? (
        <Text style={styles.desc} numberOfLines={2}>
          {desc}
        </Text>
      ) : null}

      {hero ? (
        <Image source={{ uri: hero }} style={styles.heroImg} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.heroPlaceholder}>
          <Ionicons name="image-outline" size={36} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.footerTxt} numberOfLines={1}>
            {when}
          </Text>
        </View>
        {row.location_label ? (
          <View style={styles.footerItem}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.footerTxt} numberOfLines={1}>
              {row.location_label}
            </Text>
          </View>
        ) : null}
        {warmTone ? (
          <View style={styles.footerItem}>
            <Ionicons name="heart-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.footerTxt, { fontStyle: 'italic' }]}>Open to ideas — details when you connect</Text>
          </View>
        ) : price ? (
          <View style={styles.footerItem}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
            <Text style={styles.footerTxt}>{price}</Text>
          </View>
        ) : (
          <View style={styles.footerItem}>
            <Text style={[styles.footerTxt, { fontStyle: 'italic' }]}>Open to offers</Text>
          </View>
        )}
      </View>

      {!isOwn ? (
        <View style={styles.offerBlock}>
          {offerCta.statusLabel ? (
            <Text style={styles.offerStatusHint} numberOfLines={1}>
              {offerCta.statusLabel}
            </Text>
          ) : null}
          <Pressable
            onPress={offerCta.disabled ? undefined : onPressOffer}
            disabled={offerCta.disabled}
            style={[
              styles.offerBtn,
              offerCta.muted && styles.offerBtnMuted,
              offerCta.disabled && styles.offerBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: offerCta.disabled }}
            accessibilityLabel={offerCta.label}
          >
            {offerCta.icon === 'check' ? (
              <Ionicons name="checkmark-circle" size={18} color={offerCta.muted ? colors.textMuted : colors.primary} />
            ) : offerCta.icon === 'time' ? (
              <Ionicons name="time-outline" size={18} color={offerCta.muted ? colors.textMuted : colors.primary} />
            ) : (
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            )}
            <Text
              style={[
                styles.offerBtnTxt,
                offerCta.muted && styles.offerBtnTxtMuted,
                offerCta.disabled && styles.offerBtnTxtDisabled,
              ]}
            >
              {offerCta.label}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {onDismissFromFeed && !isOwn ? (
        <Text style={styles.hideHint}>Long press to hide</Text>
      ) : null}
    </Pressable>
  );
}

export const PlanCard = memo(PlanCardInner);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  cardPressed: { opacity: 0.97 },
  top: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  avatarWrap: {},
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8EAEF' },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  avatarPhTxt: { fontSize: 18, fontWeight: '800', color: colors.textMuted },
  topMeta: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text, maxWidth: '55%' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: colors.primary },
  trustChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  trustChipTxt: { fontSize: 10, fontWeight: '800', color: '#059669' },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  profileChipTxt: { fontSize: 10, fontWeight: '700', color: '#047857' },
  dist: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 6 },
  planTitle: { fontSize: 19, fontWeight: '800', color: colors.text, flex: 1, letterSpacing: -0.3 },
  boostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: colors.secondary,
  },
  boostPillTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  listMoodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  listMoodUrgent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
  },
  listMoodUrgentTxt: { fontSize: 11, fontWeight: '900', color: '#a16207' },
  listMoodType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 101, 132, 0.12)',
    maxWidth: '70%',
  },
  listMoodTypeTxt: { fontSize: 11, fontWeight: '800', color: colors.secondary },
  listMoodTtl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hideHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  desc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
  heroImg: {
    width: '100%',
    height: 168,
    borderRadius: 18,
    backgroundColor: '#EEF0F4',
    marginBottom: spacing.sm,
  },
  heroPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 18,
    backgroundColor: '#F0F2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  footer: { gap: 8 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerTxt: { fontSize: 13, color: colors.text, flex: 1, fontWeight: '600' },
  offerBlock: { marginTop: spacing.md, gap: 6 },
  offerStatusHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  offerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  offerBtnMuted: {
    borderColor: 'rgba(15, 23, 42, 0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  offerBtnDisabled: { opacity: 0.85 },
  offerBtnTxt: { fontSize: 15, fontWeight: '800', color: colors.primary },
  offerBtnTxtMuted: { color: colors.textMuted },
  offerBtnTxtDisabled: { color: colors.textMuted },
  cardDating: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  cardDatingPressed: { opacity: 0.97 },
  datingHeroWrap: {
    height: 208,
    width: '100%',
    position: 'relative',
    backgroundColor: '#1a1a22',
  },
  datingHeroImg: { width: '100%', height: '100%' },
  datingHeroPh: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d3a',
  },
  datingHeroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  datingHeroOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  datingDistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  datingDistPillTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  datingHeroRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datingVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  datingVerifiedPillTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  datingBoostMini: {
    width: 34,
    height: 34,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  datingBody: { padding: spacing.lg },
  datingHostRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  datingHostMeta: { flex: 1, minWidth: 0 },
  datingHostName: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  datingChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  datingTrustChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  datingTrustChipTxt: { fontSize: 10, fontWeight: '800', color: '#059669' },
  datingProfileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  datingProfileChipTxt: { fontSize: 10, fontWeight: '700', color: '#047857' },
  datingMoodUrgent: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(250, 204, 21, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.35)',
  },
  datingMoodUrgentTxt: { fontSize: 10, fontWeight: '900', color: '#a16207' },
  datingMoodTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 101, 132, 0.14)',
    maxWidth: '100%',
  },
  datingMoodTypeChipTxt: { fontSize: 10, fontWeight: '800', color: colors.secondary },
  datingMoodTtlChip: { backgroundColor: 'rgba(255, 101, 132, 0.1)' },
  datingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 8,
  },
  datingDesc: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md },
  datingMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  datingMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.09)',
    maxWidth: '100%',
    flexShrink: 1,
  },
  datingMetaChipPink: { backgroundColor: 'rgba(255, 101, 132, 0.1)' },
  datingMetaChipTxt: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  datingVibeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    paddingVertical: 8,
  },
  datingVibeHintTxt: { fontSize: 13, fontWeight: '600', color: colors.textMuted, fontStyle: 'italic', flex: 1 },
  datingCtaWrap: { marginTop: spacing.md, gap: 8 },
  datingCtaHint: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  datingCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
  },
  datingCtaGradTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  datingCtaMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  datingCtaMutedTxt: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  datingHideHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
