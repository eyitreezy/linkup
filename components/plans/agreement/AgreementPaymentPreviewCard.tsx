/**
 * PL6a — explains what happens on the next screen (escrow / Flutterwave) before the user taps through.
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  formatEscrowMoney,
  patternLabel,
} from '@/lib/escrow/escrowPaymentPreview';
import {
  budgetFromGrossAmountCents,
  feeFromGrossAmountCents,
} from '@/lib/plans/planFinancialConfig';
import { isGroupSplitPlan } from '@/lib/plans/groupSplitDynamic';
import type { DbPlan, EscrowPattern } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Gross escrow amount for this user's payment row (kobo). */
  grossCents: number;
  currency: string;
  pattern: EscrowPattern;
  plan: Pick<DbPlan, 'is_group_plan' | 'escrow_pattern' | 'is_paid'>;
  /** Host waiting for guest vs payer about to continue. */
  variant: 'you_pay_next' | 'counterparty_pays' | 'split_you_pay' | 'split_waiting';
};

function contextNote(
  plan: Pick<DbPlan, 'is_group_plan' | 'escrow_pattern' | 'is_paid'>
): string {
  const isGroupSplit = isGroupSplitPlan(plan);
  const isSplitPlan = plan.escrow_pattern === 'B' && !isGroupSplit;
  if (isGroupSplit) {
    return 'Once you pay, your slot is secured. The plan activates when all parties have funded their shares.';
  }
  if (isSplitPlan) {
    return 'Both shares must be funded before the plan goes active.';
  }
  return 'Your payment is held securely in escrow until the meetup is confirmed.';
}

export function AgreementPaymentPreviewCard({
  grossCents,
  currency,
  pattern,
  plan,
  variant,
}: Props) {
  const budgetCents = budgetFromGrossAmountCents(grossCents);
  const feeCents = feeFromGrossAmountCents(grossCents);
  const fmt = (cents: number) => formatEscrowMoney(cents, currency);
  const headline = fmt(grossCents);
  const isPayerVariant = variant === 'you_pay_next' || variant === 'split_you_pay';

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(94, 82, 255,0.22)', 'rgba(255, 74, 114,0.12)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
      />
      <View style={styles.iconRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="wallet-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.headCol}>
          <Text style={styles.kicker}>Next screen</Text>
          <Text style={styles.title}>
            {variant === 'counterparty_pays' ? `Guest pays ${headline}` : `You'll pay ${headline}`}
          </Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        <PatternChip pattern={pattern} />
        <Text style={styles.chipMuted}>· Flutterwave · held in escrow</Text>
      </View>
      {isPayerVariant ? (
        <>
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Your plan contribution</Text>
              <Text style={styles.breakdownValue}>{fmt(budgetCents)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Platform fee (5%)</Text>
              <Text style={styles.breakdownFeeValue}>+ {fmt(feeCents)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownTotalLabel}>Total to Flutterwave</Text>
              <Text style={styles.breakdownTotalValue}>{fmt(grossCents)}</Text>
            </View>
          </View>
          <Text style={styles.breakdownNote}>{contextNote(plan)}</Text>
        </>
      ) : (
        <Text style={styles.body}>
          {variant === 'counterparty_pays'
            ? `No charge on this screen. ${headline} will be held in escrow on the next screen once your guest completes checkout.`
            : `You've confirmed your share. We're waiting for ${headline} from your guest on the escrow screen.`}
        </Text>
      )}
    </View>
  );
}

function PatternChip({ pattern }: { pattern: EscrowPattern }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipTxt}>{patternLabel(pattern)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCol: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: {
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  chipTxt: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  chipMuted: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: fonts.medium },
  body: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 21, fontFamily: fonts.medium },
  breakdown: {
    marginTop: spacing.xs,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  breakdownFeeValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.success,
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  breakdownTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  breakdownTotalValue: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  breakdownNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
});
