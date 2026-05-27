import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

const STEPS = ['Agree', 'Pay', 'Meet', 'Done'] as const;

type Props = {
  /** 0–3 = index of last completed step (inclusive). */
  activeIndex: number;
};

export function EscrowStepIndicator({ activeIndex }: Props) {
  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const done = i <= activeIndex;
        return (
          <View key={label} style={styles.pillWrap}>
            <View style={[styles.pill, done && styles.pillOn]}>
              <Text style={[styles.pillTxt, done && styles.pillTxtOn]}>{i + 1}</Text>
            </View>
            <Text style={[styles.lbl, done ? styles.lblOn : styles.lblOff]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  pillWrap: { flex: 1, alignItems: 'center' },
  pill: {
    width: 28,
    height: 28,
    borderRadius: radius.button,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pillOn: { backgroundColor: colors.primary },
  pillTxt: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  pillTxtOn: { color: '#fff' },
  lbl: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  lblOn: { color: colors.text },
  lblOff: { color: colors.textMuted },
});
