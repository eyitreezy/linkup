import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

const STEPS = ['Agree', 'Pay', 'Meet', 'Done'] as const;

type Props = {
  /** 0–3 = index of last completed step (inclusive). */
  activeIndex: number;
};

export function EscrowStepIndicator({ activeIndex }: Props) {
  return (
    <View style={styles.card}>
      {STEPS.map((label, i) => {
        const done = i <= activeIndex;
        const current = i === activeIndex + 1 && activeIndex < STEPS.length - 1;
        return (
          <View key={label} style={styles.stepCol}>
            <View style={[styles.pill, done && styles.pillOn, current && styles.pillCurrent]}>
              <Text style={[styles.pillTxt, (done || current) && styles.pillTxtOn]}>{i + 1}</Text>
            </View>
            <Text style={[styles.lbl, done ? styles.lblOn : current ? styles.lblCurrent : styles.lblOff]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  stepCol: { flex: 1, alignItems: 'center' },
  pill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pillOn: { backgroundColor: colors.primary },
  pillCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(255, 101, 132, 0.55)',
  },
  pillTxt: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  pillTxtOn: { color: '#fff' },
  lbl: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  lblOn: { color: colors.text },
  lblCurrent: { color: colors.primary },
  lblOff: { color: colors.textMuted },
});
