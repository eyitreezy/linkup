/**
 * Full-bleed sticky wizard progress — lives outside ScrollView (same pattern as create-plan).
 */
import {
  ONBOARDING_STEP_LABELS,
  ONBOARDING_TOTAL_STEPS,
} from '@/lib/onboarding/constants';
import { colors, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  step: number;
  total?: number;
};

export function OnboardingStickyProgress({ step, total = ONBOARDING_TOTAL_STEPS }: Props) {
  const idx = Math.max(0, Math.min(step, total - 1));
  const label = ONBOARDING_STEP_LABELS[idx] ?? `Step ${idx + 1}`;

  return (
    <View style={styles.stickyWrap}>
      <View style={styles.row}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={styles.slot}>
            {i === idx ? (
              <LinearGradient
                colors={[colors.primary, '#8B7CE8', colors.secondary]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.barGrad}
              />
            ) : (
              <MotiView
                animate={{ opacity: i < idx ? 1 : 0.35 }}
                transition={{ type: 'timing', duration: 220 }}
                style={[styles.bar, i < idx ? styles.barDone : styles.barMuted]}
              />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.caption}>
        Step {idx + 1} of {total} · <Text style={styles.captionAccent}>{label}</Text>
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
  row: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    width: '100%',
    height: 5,
  },
  slot: { flex: 1, height: 5 },
  barGrad: { flex: 1, height: 5, borderRadius: 3 },
  bar: { height: 5, borderRadius: 3 },
  barDone: { backgroundColor: colors.primary },
  barMuted: { backgroundColor: 'rgba(108, 99, 255, 0.15)' },
  caption: {
    marginTop: 10,
    paddingHorizontal: spacing.md,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  captionAccent: { color: colors.primary },
});
