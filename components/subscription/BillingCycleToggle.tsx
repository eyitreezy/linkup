import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import type { BillingCycle } from '@/lib/subscription/pricing';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
      <Text style={styles.label}>Billing</Text>
      <View style={styles.track}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
              accessibilityRole="button"
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
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  track: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md + 2,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md + 2,
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
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  chipLabelOn: {
    color: '#fff',
    fontWeight: '900',
  },
  chipHint: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 12,
  },
  chipHintOn: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '800',
  },
  hintSpacer: {
    height: 14,
  },
});
