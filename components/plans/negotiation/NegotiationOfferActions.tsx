import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { OfferStatusBadge, offerBadgeExpired } from '@/components/plans/negotiation/OfferStatusBadge';
import { NegotiationThread } from '@/components/plans/negotiation/NegotiationThread';
import { negotiationPanelStyles } from '@/components/plans/negotiation/negotiationPanelStyles';
import { resolvePlanAgreementHref } from '@/lib/plans/planAgreementRoute';
import { deriveNegotiationContext, isOfferLive, offerLiveAmount } from '@/lib/plans/negotiationState';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  offer: DbPlanOffer;
  plan: DbPlan;
  currentUserId?: string;
  bidderName?: string;
  busy?: boolean;
  refreshToken?: number;
  onAccept: () => void;
  onCounter: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
};

function formatOfferAmount(cents: number, currency: string): string {
  const n = cents / 100;
  if (currency === 'NGN') return `₦${n.toLocaleString()}`;
  return `${n.toFixed(0)} ${currency}`;
}

export function NegotiationOfferActions({
  offer,
  plan,
  currentUserId,
  bidderName,
  busy,
  refreshToken,
  onAccept,
  onCounter,
  onDecline,
  onWithdraw,
}: Props) {
  const { isHost, isMyTurn, isOthersTurn, isLive, canWithdraw } = deriveNegotiationContext(
    offer,
    plan,
    currentUserId
  );
  const expired = isOfferExpired(offer);
  const amount = offerLiveAmount(offer);
  const live = isOfferLive(offer);
  const isAccepted = offer.status === 'accepted';

  return (
    <View style={[negotiationPanelStyles.card, styles.card]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.kicker}>
            {live && !expired ? 'Offer on the table' : 'Final offer'}
            {bidderName && isHost ? ` · ${bidderName}` : ''}
          </Text>
          <Text style={styles.amount}>
            {amount != null && amount > 0 ? formatOfferAmount(amount, plan.currency) : 'Open amount'}
          </Text>
        </View>
        <OfferStatusBadge status={offer.status} expired={offerBadgeExpired(offer)} />
      </View>

      {!isAccepted && isLive && isMyTurn && !expired ? (
        <View style={styles.offerActions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onAccept}
            style={({ pressed }) => [styles.acceptOuter, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[...APP_CTA_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <Text style={styles.acceptLabel}>Accept</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onCounter}
            style={({ pressed }) => [styles.counterBtn, pressed && styles.pressed]}
          >
            <Text style={styles.counterLabel}>Counter</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDecline}
            style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
          >
            <Text style={styles.declineLabel}>Decline</Text>
          </Pressable>
        </View>
      ) : null}

      {!isAccepted && canWithdraw && !expired ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onWithdraw}
          style={({ pressed }) => [styles.withdrawBtn, pressed && styles.pressed]}
        >
          <Text style={styles.withdrawLabel}>Withdraw my offer</Text>
        </Pressable>
      ) : null}

      {!isAccepted && isLive && isOthersTurn && !expired ? (
        <View style={styles.waitingRow}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.waitingText}>
            Waiting for the {isHost ? 'guest' : 'host'} to respond
          </Text>
        </View>
      ) : null}

      {isAccepted ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push(
              resolvePlanAgreementHref(plan, { offerId: offer.id, userId: currentUserId, offers: [offer] })
            )
          }
          style={({ pressed }) => [styles.viewAgreementOuter, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[...APP_CTA_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewAgreementGrad}
          >
            <Text style={styles.viewAgreementLabel}>View agreement</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      <NegotiationThread
        offerId={offer.id}
        planId={plan.id}
        currentUserId={currentUserId}
        currency={plan.currency}
        embedded
        refreshToken={refreshToken}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  amount: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  offerActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  acceptOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  actionBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  acceptLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  counterBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.25)',
    backgroundColor: 'rgba(237, 232, 255, 0.45)',
    paddingHorizontal: spacing.xs,
  },
  counterLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  declineBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: spacing.xs,
  },
  declineLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#DC2626',
  },
  withdrawBtn: {
    alignSelf: 'flex-start',
  },
  withdrawLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waitingText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  viewAgreementOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  viewAgreementGrad: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  viewAgreementLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
});
