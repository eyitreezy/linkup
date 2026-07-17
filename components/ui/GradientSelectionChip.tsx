/**
 * Pill / chip with app-standard gradient when selected.
 */
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, fonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Fixed chip height — idle border and gradient selected state share the same box. */
export const GRADIENT_CHIP_HEIGHT = 44;

type Props = {
  label?: string;
  selected: boolean;
  onPress: () => void;
  children?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function GradientSelectionChip({
  label,
  selected,
  onPress,
  children,
  compact,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.press, compact && styles.pressCompact, style]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {selected ? (
        <LinearGradient
          colors={[...APP_CHIP_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.inner, compact && styles.innerCompact]}
        >
          {children ?? (label ? <Text style={styles.txtOn} numberOfLines={1}>{label}</Text> : null)}
        </LinearGradient>
      ) : (
        <View style={[styles.inner, styles.idle, compact && styles.innerCompact]}>
          {children ?? (label ? <Text style={styles.txt} numberOfLines={1}>{label}</Text> : null)}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    height: GRADIENT_CHIP_HEIGHT,
    borderRadius: radius.button,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  pressCompact: { borderRadius: radius.button },
  inner: {
    height: GRADIENT_CHIP_HEIGHT,
    minWidth: GRADIENT_CHIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCompact: {
    paddingHorizontal: 12,
  },
  idle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txt: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  txtOn: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
  },
});
