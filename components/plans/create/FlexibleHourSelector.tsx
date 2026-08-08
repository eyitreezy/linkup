/**
 * Flexible hour/minute selector with stepper, slider, and optional quick presets.
 */
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: 'hours' | 'minutes';
  presets?: readonly number[];
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

function defaultFormat(value: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'hours') return value === 1 ? '1 hour' : `${value} hours`;
  if (value < 60) return `${value} min`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

export function FlexibleHourSelector({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  presets,
  formatValue,
  onChange,
}: Props) {
  const display = formatValue ? formatValue(value) : defaultFormat(value, unit);

  function clamp(next: number) {
    return Math.max(min, Math.min(max, Math.round(next / step) * step));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(clamp(value - step))}
          disabled={value <= min}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, value <= min && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.stepBtnTxt}>−</Text>
        </Pressable>
        <View style={styles.valueCol}>
          <Text style={styles.valueTxt}>{display}</Text>
          <Text style={styles.rangeTxt}>
            {min} to {max} {unit}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange(clamp(value + step))}
          disabled={value >= max}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, value >= max && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.stepBtnTxt}>+</Text>
        </Pressable>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(clamp(v))}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor="rgba(94, 82, 255, 0.15)"
        thumbTintColor={colors.primary}
      />
      {presets?.length ? (
        <View style={styles.presetsRow} accessibilityRole="radiogroup" accessibilityLabel={`${label} quick presets`}>
          {presets.map((preset) => {
            const selected = value === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => onChange(clamp(preset))}
                style={[styles.presetChip, selected && styles.presetChipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={formatValue ? formatValue(preset) : defaultFormat(preset, unit)}
              >
                <Text style={[styles.presetChipTxt, selected && styles.presetChipTxtOn]}>
                  {formatValue ? formatValue(preset) : defaultFormat(preset, unit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: spacing.sm },
  label: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnTxt: { fontSize: 22, fontWeight: '800', color: colors.primary, fontFamily: fonts.bold },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.35 },
  valueCol: { minWidth: 120, alignItems: 'center' },
  valueTxt: { fontSize: 20, fontWeight: '900', color: colors.text, fontFamily: fonts.bold },
  rangeTxt: { marginTop: 2, fontSize: 11, fontWeight: '600', color: colors.textMuted, fontFamily: fonts.medium },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    justifyContent: 'center',
  },
  presetChipOn: { backgroundColor: colors.primary },
  presetChipTxt: { fontSize: 12, fontWeight: '800', color: colors.primary, fontFamily: fonts.bold },
  presetChipTxtOn: { color: '#fff' },
});
