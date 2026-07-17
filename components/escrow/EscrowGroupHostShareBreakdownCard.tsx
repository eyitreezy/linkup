/**
 * Group split host share breakdown — mirrors linkup-web EscrowGroupHostShareBreakdownCard.
 */
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  planTotalCents: number;
  guestsCommittedCents: number;
  hostShareCents: number;
  /** Gross checkout amount for the host leg (includes platform fee). */
  hostPayGrossCents?: number;
  currency: string;
  groupClosed: boolean;
  hostShareFunded: boolean;
  hostEscrowId?: string | null;
};

export function EscrowGroupHostShareBreakdownCard({
  planTotalCents,
  guestsCommittedCents,
  hostShareCents,
  hostPayGrossCents,
  currency,
  groupClosed,
  hostShareFunded,
  hostEscrowId,
}: Props) {
  const fmt = (cents: number) => formatEscrowMoney(cents, currency);
  const hostCheckoutCents =
    hostPayGrossCents != null && hostPayGrossCents > 0
      ? hostPayGrossCents
      : grossAmountCents(hostShareCents);

  const statusText = hostShareFunded
    ? 'Your host share is funded.'
    : groupClosed
      ? 'Pending your payment on your host escrow leg.'
      : 'Close the group when you are ready to lock in your share and pay.';

  const statusColor = hostShareFunded
    ? colors.success
    : groupClosed
      ? '#B45309'
      : colors.textMuted;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(255, 74, 114, 0.12)', 'rgba(94, 82, 255, 0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topGlow}
      />

      <Text style={styles.kicker}>Group plan · Host share</Text>
      <View style={styles.titleRow}>
        {!hostShareFunded ? (
          <Ionicons
            name="hourglass-outline"
            size={48}
            color="rgba(94, 82, 255, 0.12)"
            style={styles.titleWatermark}
          />
        ) : null}
        <Text style={styles.title}>Your host share</Text>
      </View>
      <Text style={styles.body}>
        In a group split plan, each guest pays their negotiated share into escrow. Your host share is the
        remainder: the plan total minus what accepted guests have committed so far.
      </Text>

      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Plan total</Text>
          <Text style={styles.breakdownValueDark}>{fmt(planTotalCents)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={styles.guestsLabelRow}>
            <Ionicons name="people-outline" size={15} color={colors.secondary} />
            <Text style={styles.breakdownLabel}>Guests committed</Text>
          </View>
          <Text style={styles.breakdownValueMuted}>− {fmt(guestsCommittedCents)}</Text>
        </View>
        <LinearGradient
          colors={['rgba(237, 232, 255, 0.95)', 'rgba(243, 238, 255, 0.75)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.hostShareRow}
        >
          <View style={styles.hostShareCopy}>
            <Text style={styles.hostShareKicker}>Your host share</Text>
            <Text style={styles.hostShareNote}>
              {groupClosed ? 'Final after closing the group' : 'Projected. Updates as more guests join.'}
            </Text>
          </View>
          <View style={styles.hostShareAmountRow}>
            <Text style={styles.hostShareAmount}>{fmt(hostShareCents)}</Text>
            <Ionicons
              name={hostShareFunded ? 'checkmark-circle' : 'hourglass-outline'}
              size={22}
              color={hostShareFunded ? colors.success : '#D97706'}
            />
          </View>
        </LinearGradient>
      </View>

      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>

      {hostEscrowId && !hostShareFunded && hostShareCents > 0 ? (
        <Pressable
          onPress={() => router.push(`/escrow/${hostEscrowId}` as Href)}
          style={({ pressed }) => [pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] }]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[...APP_CTA_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Text style={styles.ctaTxt}>Pay your host share · {fmt(hostCheckoutCents)}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    overflow: 'hidden',
    ...cardShadow,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  titleRow: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  titleWatermark: {
    position: 'absolute',
    right: 0,
    top: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  breakdown: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(94, 82, 255, 0.1)',
  },
  guestsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  breakdownValueDark: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  breakdownValueMuted: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  hostShareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  hostShareCopy: {
    flex: 1,
    minWidth: 0,
  },
  hostShareKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hostShareNote: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  hostShareAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  hostShareAmount: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    marginBottom: spacing.sm,
  },
  ctaGrad: {
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    textAlign: 'center',
  },
});
