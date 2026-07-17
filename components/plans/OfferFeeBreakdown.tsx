import { colors, fonts } from '@/constants/theme';
import { formatGroupSplitCents } from '@/lib/plans/groupSplitDynamic';
import {
  grossAmountCents,
  platformFeeCentsForAmount,
} from '@/lib/plans/planFinancialConfig';
import { StyleSheet, Text, View } from 'react-native';

interface OfferFeeBreakdownProps {
  budgetCents: number;
  currency?: string;
  /** When true, shows a divider line above the total row */
  showDivider?: boolean;
}

export function OfferFeeBreakdown({
  budgetCents,
  currency = 'NGN',
  showDivider = true,
}: OfferFeeBreakdownProps) {
  if (!budgetCents || budgetCents <= 0) return null;

  const feeCents = platformFeeCentsForAmount(budgetCents);
  const totalGross = grossAmountCents(budgetCents);
  const fmt = (cents: number) => formatGroupSplitCents(cents, currency);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Platform fee (5%)</Text>
        <Text style={styles.rowFeeValue}>+ {fmt(feeCents)}</Text>
      </View>

      {showDivider ? <View style={styles.divider} /> : null}

      <View style={styles.row}>
        <Text style={styles.rowTotalLabel}>Total you pay</Text>
        <Text style={styles.rowTotalValue}>{fmt(totalGross)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  rowFeeValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.success,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  rowTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  rowTotalValue: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
