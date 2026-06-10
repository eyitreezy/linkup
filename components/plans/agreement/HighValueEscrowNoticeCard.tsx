/**
 * Inline notice when escrow exceeds Tier 1 cap — requirements before secure payment.
 */
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { MAX_ESCROW_TIER1_CENTS } from '@/lib/plans/planFinancialConfig';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import type { EscrowPattern, SubscriptionTier } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  amountCents: number;
  currency: string;
  escrowPattern: EscrowPattern | string | null | undefined;
  userTier: SubscriptionTier | string | undefined;
  userKycTier: number | undefined;
  counterpartyKycTier?: number | null;
  onUpgrade: () => void;
};

function ReqRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={[styles.reqRow, met && styles.reqRowMet]}>
      <View style={[styles.reqIcon, met ? styles.reqIconMet : styles.reqIconPending]}>
        <Ionicons
          name={met ? 'checkmark' : 'ellipse-outline'}
          size={met ? 14 : 12}
          color={met ? '#fff' : colors.textMuted}
        />
      </View>
      <Text style={[styles.reqTxt, met && styles.reqTxtMet]}>{label}</Text>
    </View>
  );
}

export function HighValueEscrowNoticeCard({
  amountCents,
  currency,
  escrowPattern,
  userTier,
  userKycTier,
  counterpartyKycTier,
  onUpgrade,
}: Props) {
  if (amountCents <= MAX_ESCROW_TIER1_CENTS) return null;

  const hasPlatinum = userTier === 'PLATINUM';
  const hasTier3 = (userKycTier ?? 1) >= 3;
  const patternC = escrowPattern === 'C';
  const counterpartyOk = !patternC || (counterpartyKycTier ?? 1) >= 3;
  const allMet = hasPlatinum && hasTier3 && counterpartyOk;

  const amountLabel = formatEscrowMoney(amountCents, currency);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />

      <View style={styles.headerRow}>
        <LinearGradient colors={[...APP_CHIP_GRADIENT]} style={styles.iconGrad}>
          <Ionicons name="diamond-outline" size={22} color="#fff" />
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>High-value escrow</Text>
          <Text style={styles.title}>{amountLabel} commitment</Text>
        </View>
      </View>

      <Text style={styles.body}>
        Amounts above ₦5,000,000 need Platinum membership and advanced identity verification before you can proceed to
        secure payment.
      </Text>

      <View style={styles.reqList}>
        <ReqRow met={hasPlatinum} label="Platinum subscription on your account" />
        <ReqRow met={hasTier3} label="Identity verification Tier 3 (you)" />
        {patternC ? (
          <ReqRow met={!!counterpartyOk} label="Guest-funded plan — guest also needs Tier 3" />
        ) : null}
      </View>

      {!allMet ? (
        <Pressable onPress={onUpgrade} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
          <LinearGradient
            colors={[...APP_CHIP_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Ionicons name="sparkles-outline" size={18} color="#fff" />
            <Text style={styles.ctaTxt}>
              {!hasPlatinum ? 'Upgrade to Platinum' : !hasTier3 ? 'Complete Tier 3 verification' : 'View requirements'}
            </Text>
          </LinearGradient>
        </Pressable>
      ) : (
        <View style={styles.readyBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.readyTxt}>Requirements met — you can proceed to secure payment.</Text>
        </View>
      )}
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
});

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  iconGrad: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  body: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  reqList: { gap: spacing.sm, marginBottom: spacing.md },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  reqRowMet: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  reqIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqIconMet: { backgroundColor: colors.success },
  reqIconPending: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  reqTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  reqTxtMet: { color: '#047857' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
  },
  ctaTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  readyTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#047857', lineHeight: 18 },
});
