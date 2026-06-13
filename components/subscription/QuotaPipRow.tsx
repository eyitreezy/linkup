/**
 * Monthly quota pips — shared by boost and spotlight cards.
 */
import { colors, spacing } from '@/constants/theme';
import { getMonthResetLabel } from '@/lib/subscription/boostQuota';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  total: number;
  used: number;
  unlimited?: boolean;
  unlimitedLabel?: string;
  exhaustedReset?: boolean;
  remainingLabel?: string;
};

export function QuotaPipRow({
  total,
  used,
  unlimited,
  unlimitedLabel = 'Unlimited',
  exhaustedReset,
  remainingLabel,
}: Props) {
  if (unlimited) {
    return <Text style={styles.unlimitedTxt}>{unlimitedLabel}</Text>;
  }

  if (total <= 0) return null;

  const remaining = Math.max(0, total - used);
  const label =
    remainingLabel ??
    (remaining <= 0
      ? `Resets ${getMonthResetLabel()}`
      : `${remaining} left · resets ${getMonthResetLabel()}`);

  return (
    <View style={styles.row}>
      <View style={styles.pips}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.pip, i < used ? styles.pipUsed : styles.pipAvailable]} />
        ))}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {exhaustedReset && remaining <= 0 ? `Resets ${getMonthResetLabel()}` : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipUsed: {
    backgroundColor: colors.textMuted,
    opacity: 0.45,
  },
  pipAvailable: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  unlimitedTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
