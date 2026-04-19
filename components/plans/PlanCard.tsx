/**
 * Hybrid plan card — media-forward header, trust signals, quick actions.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { isUserVerified } from '@/lib/verification/access';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { derivePresenceUi } from '@/lib/presence/derivePresenceUi';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlanOffer, DbProfile, DbUserPresence } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

function isBoostActive(boostedUntil: string | null | undefined): boolean {
  if (!boostedUntil) return false;
  return new Date(boostedUntil).getTime() > Date.now();
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

function deriveOfferCta(offer: DbPlanOffer | null | undefined): OfferCta {
  if (!offer) {
    return { label: 'Send offer', icon: 'arrow', disabled: false, muted: false };
  }
  const dead = isOfferExpired(offer);
  if (offer.status === 'accepted') {
    return {
      label: 'Accepted',
      statusLabel: 'Accepted',
      icon: 'check',
      disabled: true,
      muted: true,
    };
  }
  if ((offer.status === 'pending' || offer.status === 'countered') && !dead) {
    if (offer.status === 'pending') {
      return {
        label: 'Offer Sent',
        statusLabel: offerStatusDisplay('pending'),
        icon: 'time',
        disabled: true,
        muted: true,
      };
    }
    return {
      label: 'Continue',
      statusLabel: offerStatusDisplay('countered'),
      icon: 'arrow',
      disabled: false,
      muted: false,
    };
  }
  return { label: 'Send offer', icon: 'arrow', disabled: false, muted: false };
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
  const boosted = isBoostActive(row.boosted_until);
  const offerCta = useMemo(() => deriveOfferCta(userOffer ?? null), [userOffer]);
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
        {price ? (
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
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  boostPillTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
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
});
