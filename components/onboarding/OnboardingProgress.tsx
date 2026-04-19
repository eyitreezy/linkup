import { onboarding } from '@/components/onboarding/onboardingTheme';
import { StyleSheet, Text, View } from 'react-native';

/** Same horizontal inset as `onboarding/index` `headerRow` so "Step X of Y" aligns with ← Back. */

type Props = {
  step: number;
  total?: number;
};

export function OnboardingProgress({ step, total = 5 }: Props) {
  const pct = ((step + 1) / total) * 100;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Step {step + 1} of {total}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: onboarding.spacing.lg,
    paddingHorizontal: onboarding.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: onboarding.muted,
    marginBottom: onboarding.spacing.sm,
    letterSpacing: 0.3,
  },
  track: {
    height: 6,
    borderRadius: 200,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 200,
    backgroundColor: onboarding.accent,
  },
});
