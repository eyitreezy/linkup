/**
 * Pill / chip with app-standard gradient when selected.
 */
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius } from '@/constants/theme';
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
      style={[styles.press, style]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {selected ? (
        <LinearGradient
          colors={[...APP_CHIP_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.grad, compact && styles.gradCompact]}
        >
          {children ?? (label ? <Text style={styles.txtOn}>{label}</Text> : null)}
        </LinearGradient>
      ) : (
        <View style={[styles.idle, compact && styles.idleCompact]}>
          {children ?? (label ? <Text style={styles.txt}>{label}</Text> : null)}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { borderRadius: radius.button, overflow: 'hidden' },
  grad: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
  },
  gradCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  idle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idleCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  txt: { fontSize: 13, fontWeight: '800', color: colors.text },
  txtOn: { fontSize: 13, fontWeight: '900', color: '#fff', textAlign: 'center' },
});
