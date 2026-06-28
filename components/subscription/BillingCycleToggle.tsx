import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import type { BillingCycle } from '@/lib/subscription/pricing';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
};

const OPTIONS: { id: BillingCycle; label: string; hint?: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Annual', hint: 'Best value' },
];

const SEGMENT_HEIGHT = 56;

export function BillingCycleToggle({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              {selected ? (
                <LinearGradient
                  colors={[...APP_CHIP_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.segmentFill}
                />
              ) : null}
              <View style={styles.labelStack}>
                <Text
                  style={[styles.chipLabel, selected && styles.chipLabelOn]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
                {opt.hint ? (
                  <Text
                    style={[styles.chipHint, selected && styles.chipHintOn]}
                    numberOfLines={1}
                  >
                    {opt.hint}
                  </Text>
                ) : (
                  <View style={styles.hintSpacer} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.button,
  },
  segmentPressed: { opacity: 0.92 },
  labelStack: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    paddingHorizontal: spacing.xs,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  chipLabelOn: {
    color: '#fff',
    fontWeight: '900',
    fontFamily: fonts.bold,
  },
  chipHint: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 12,
  },
  chipHintOn: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '800',
    fontFamily: fonts.bold,
  },
  hintSpacer: {
    height: 14,
  },
});
