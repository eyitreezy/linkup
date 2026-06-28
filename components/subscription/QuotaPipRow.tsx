/**
 * Monthly quota pips — shared by boost and spotlight cards.
 */
import { colors, spacing, fonts } from '@/constants/theme';
import { getMonthResetLabel } from '@/lib/subscription/boostQuota';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  total: number;
  used: number;
  unlimited?: boolean;
  unlimitedLabel?: string;
  exhaustedReset?: boolean;
  remainingLabel?: string;
  /** `embedded` — inside active boost card (left-aligned, tighter spacing). */
  variant?: 'default' | 'embedded';
};

export function QuotaPipRow({
  total,
  used,
  unlimited,
  unlimitedLabel = 'Unlimited',
  exhaustedReset,
  remainingLabel,
  variant = 'default',
}: Props) {
  if (unlimited) {
    return null;
  }

  if (total <= 0) return null;

  const remaining = Math.max(0, total - used);
  const label =
    remainingLabel ??
    (remaining <= 0
      ? `Resets ${getMonthResetLabel()}`
      : `${remaining} left · resets ${getMonthResetLabel()}`);

  const embedded = variant === 'embedded';

  return (
    <View style={[styles.row, embedded && styles.rowEmbedded]}>
      <View style={[styles.pips, embedded && styles.pipsEmbedded]}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              embedded && styles.pipEmbedded,
              i < used ? styles.pipUsed : styles.pipAvailable,
              embedded && i < used && styles.pipUsedEmbedded,
              embedded && i >= used && styles.pipAvailableEmbedded,
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, embedded && styles.labelEmbedded]} numberOfLines={2}>
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
  rowEmbedded: {
    marginTop: 0,
    gap: 6,
  },
  pips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  pipsEmbedded: {
    justifyContent: 'flex-start',
    gap: 5,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipEmbedded: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pipUsed: {
    backgroundColor: colors.textMuted,
    opacity: 0.45,
  },
  pipAvailable: {
    backgroundColor: colors.primary,
  },
  pipUsedEmbedded: {
    opacity: 0.35,
  },
  pipAvailableEmbedded: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelEmbedded: {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    opacity: 0.72,
    letterSpacing: 0.1,
  },
  unlimitedTxt: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
