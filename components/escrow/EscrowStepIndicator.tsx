import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

const STEPS = ['Agree', 'Pay', 'Meet', 'Done'] as const;

type Props = {
  /** 0–3 = index of last completed step (inclusive). */
  activeIndex: number;
};

export function EscrowStepIndicator({ activeIndex }: Props) {
  const progress = activeIndex / (STEPS.length - 1);

  return (
    <View style={styles.card}>
      <View style={styles.trackRow}>
        <View style={styles.trackBg} />
        <View style={[styles.trackFill, { width: `${Math.max(progress * 100, 0)}%` }]} />
        <View style={styles.pillsRow}>
          {STEPS.map((label, i) => {
            const done = i <= activeIndex;
            const current = i === activeIndex + 1 && activeIndex < STEPS.length - 1;

            return (
              <View key={label} style={styles.stepCol}>
                {done ? (
                  <LinearGradient
                    colors={[...APP_CHIP_GRADIENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.pillGrad}
                  >
                    <Text style={styles.pillTxtOn}>{i + 1}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.pill, current && styles.pillCurrent]}>
                    <Text style={[styles.pillTxt, current && styles.pillTxtCurrent]}>{i + 1}</Text>
                  </View>
                )}
                <Text
                  style={[styles.lbl, done ? styles.lblOn : current ? styles.lblCurrent : styles.lblOff]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  trackRow: { position: 'relative', paddingTop: 4 },
  trackBg: {
    position: 'absolute',
    top: 20,
    left: '12%',
    right: '12%',
    height: 2,
    backgroundColor: '#D8DCE6',
    borderRadius: 1,
  },
  trackFill: {
    position: 'absolute',
    top: 20,
    left: '12%',
    height: 2,
    backgroundColor: 'rgba(108, 99, 255, 0.5)',
    borderRadius: 1,
    maxWidth: '76%',
  },
  pillsRow: { flexDirection: 'row' },
  stepCol: { flex: 1, alignItems: 'center' },
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pillCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  pillGrad: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pillTxt: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  pillTxtCurrent: { color: colors.primary },
  pillTxtOn: { fontSize: 13, fontWeight: '900', color: '#fff' },
  lbl: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  lblOn: { color: colors.text },
  lblCurrent: { color: colors.primary },
  lblOff: { color: colors.textMuted },
});
