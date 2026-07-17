import { colors, fonts, radius, spacing } from '@/constants/theme';
import { formatGroupSplitCents } from '@/lib/plans/groupSplitDynamic';
import {
  grossAmountCents,
  platformFeeCentsForAmount,
} from '@/lib/plans/planFinancialConfig';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface PlanBudgetFeeNotifierProps {
  budgetCents: number;
  participantCount: number;
  isGroupPlan: boolean;
  currency?: string;
}

export function PlanBudgetFeeNotifier({
  budgetCents,
  participantCount,
  isGroupPlan,
  currency = 'NGN',
}: PlanBudgetFeeNotifierProps) {
  if (!budgetCents || budgetCents <= 0) return null;

  const feeCents = platformFeeCentsForAmount(budgetCents);
  const grossCents = grossAmountCents(budgetCents);
  const perPersonGross =
    isGroupPlan && participantCount > 1 ? Math.ceil(grossCents / participantCount) : grossCents;
  const perPersonBudget =
    isGroupPlan && participantCount > 1 ? Math.ceil(budgetCents / participantCount) : budgetCents;
  const perPersonFee = perPersonGross - perPersonBudget;
  const fmt = (cents: number) => formatGroupSplitCents(cents, currency);

  return (
    <View style={styles.notifierCard}>
      <View style={styles.notifierHeader}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.notifierHeaderText}>How the plan budget is shared</Text>
      </View>

      <View style={styles.notifierRows}>
        <View style={styles.notifierRow}>
          <Text style={styles.notifierRowLabel}>Plan budget</Text>
          <Text style={styles.notifierRowValue}>{fmt(budgetCents)}</Text>
        </View>
        <View style={styles.notifierRow}>
          <Text style={styles.notifierRowLabel}>Platform fee (5%)</Text>
          <Text style={styles.notifierRowValueFee}>+ {fmt(feeCents)}</Text>
        </View>
        <View style={styles.notifierDivider} />
        <View style={styles.notifierRow}>
          <Text style={styles.notifierRowLabelBold}>Total</Text>
          <Text style={styles.notifierRowValueBold}>{fmt(grossCents)}</Text>
        </View>
      </View>

      {isGroupPlan && participantCount > 1 ? (
        <Text style={styles.notifierPerPersonText}>
          {`With ${participantCount} participants, each person contributes `}
          <Text style={styles.notifierPerPersonAmount}>{fmt(perPersonGross)}</Text>
          {` (${fmt(perPersonBudget)} plan share + ${fmt(perPersonFee)} fee).`}
        </Text>
      ) : null}

      <View style={styles.notifierFooter}>
        <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
        <Text style={styles.notifierFooterText}>
          {`You receive your full ${fmt(budgetCents)} budget after the meetup is confirmed.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notifierCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#F8F7FF',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
  },
  notifierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  notifierHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  notifierRows: { gap: 6 },
  notifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifierRowLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  notifierRowValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  notifierRowValueFee: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.success,
  },
  notifierDivider: {
    height: 1,
    backgroundColor: 'rgba(94, 82, 255, 0.14)',
    marginVertical: 2,
  },
  notifierRowLabelBold: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  notifierRowValueBold: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  notifierPerPersonText: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.primary,
    lineHeight: 18,
  },
  notifierPerPersonAmount: {
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  notifierFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
  },
  notifierFooterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
