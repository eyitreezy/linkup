/**
 * 3-step wizard progress — Bumble structure + gradient active step (Tinder/Hinge energy).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';

const LABELS = ['Meet & mood', 'Commitment', 'Details'];

type Props = { current: 0 | 1 | 2 };

/** Fixed under the stack header — do not place inside a ScrollView. */
export function CreatePlanStickyProgress({ current }: Props) {
  return (
    <View style={styles.stickyWrap}>
      <CreatePlanProgressBar current={current} />
    </View>
  );
}

export function CreatePlanProgressBar({ current }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[0, 1, 2].map((step) => (
          <View key={step} style={styles.slot}>
            {step === current ? (
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.barGrad}
              />
            ) : (
              <MotiView
                animate={{
                  scaleX: 1,
                  opacity: step < current ? 1 : 0.35,
                }}
                transition={{ type: 'timing', duration: 240 }}
                style={[styles.bar, step < current ? styles.barDone : styles.barMuted]}
              />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.label}>
        Step {current + 1} of 3 · <Text style={styles.labelAccent}>{LABELS[current]}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyWrap: {
    width: '100%',
    paddingTop: 0,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(108, 99, 255, 0.12)',
    zIndex: 2,
  },
  wrap: { width: '100%' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' },
  slot: { flex: 1, height: 5 },
  barGrad: {
    height: 5,
    borderRadius: 3,
    flex: 1,
  },
  bar: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barDone: { backgroundColor: colors.primary },
  barMuted: { backgroundColor: colors.border },
  label: {
    marginTop: 10,
    paddingHorizontal: spacing.md,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  labelAccent: { color: colors.primary },
});
