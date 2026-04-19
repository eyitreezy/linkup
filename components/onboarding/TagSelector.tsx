import { authSoftLabelStyle } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  max?: number;
};

export function TagSelector({ label, options, selected, onToggle, max = 8 }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[authSoftLabelStyle, styles.labelSpacing]}>{label}</Text>
      <View style={styles.row}>
        {options.map((tag) => {
          const on = selected.includes(tag);
          const disabled = !on && selected.length >= max;
          return (
            <MotiView key={tag} from={{ opacity: 0.85 }} animate={{ opacity: 1 }}>
              <Pressable
                onPress={() => !disabled && onToggle(tag)}
                disabled={disabled}
                style={[styles.chip, on && styles.chipOn, disabled && styles.chipDisabled]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
              </Pressable>
            </MotiView>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: onboarding.spacing.md },
  labelSpacing: { marginBottom: onboarding.spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  chipOn: {
    backgroundColor: onboarding.accentSoft,
    borderColor: onboarding.accent,
  },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 14, fontWeight: '600', color: onboarding.text },
  chipTextOn: { color: onboarding.accent },
});
