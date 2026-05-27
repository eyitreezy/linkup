import { authSoftLabelStyle } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  max?: number;
};

/** Same horizontal gradient as active chips elsewhere (primary → violet → secondary). */
const ACTIVE_GRADIENT = [colors.primary, '#8B7CE8', colors.secondary] as const;

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
                style={[styles.chipOuter, disabled && styles.chipDisabled]}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled }}
              >
                {on ? (
                  <LinearGradient
                    colors={[...ACTIVE_GRADIENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.chipActive}
                  >
                    <Text style={styles.chipTextOn}>{tag}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.chipIdle}>
                    <Text style={styles.chipText}>{tag}</Text>
                  </View>
                )}
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
  chipOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  chipIdle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  chipActive: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 14, fontWeight: '600', color: onboarding.text },
  chipTextOn: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
});
