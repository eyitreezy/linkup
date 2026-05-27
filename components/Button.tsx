/**
 * Primary / secondary action buttons — LinkUp theme.
 */
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type Props = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  /** Primary → purple→pink gradient (app-standard CTA). */
  gradient?: boolean;
  /** Pill CTA (dating-app style primary actions) */
  pill?: boolean;
  /** Stretch to parent width (auth screens). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  gradient = false,
  pill,
  fullWidth,
  style,
  textStyle,
  ...rest
}: Props) {
  const useGradient = gradient && variant === 'primary';
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.secondary
        : 'transparent';
  const color = variant === 'ghost' ? colors.primary : '#fff';

  const content = loading ? (
    <ActivityIndicator color={color} />
  ) : (
    <Text style={[styles.text, fullWidth && styles.textAuth, { color }, textStyle]}>{title}</Text>
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        useGradient ? styles.gradientOuter : styles.base,
        pill && styles.pill,
        fullWidth && styles.fullWidth,
        (variant === 'primary' || useGradient) && fullWidth && styles.primaryFullWidthDepth,
        !useGradient && {
          backgroundColor: bg,
        },
        {
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed && !disabled && !loading ? 0.97 : 1 }],
        },
        !useGradient && variant === 'ghost' && styles.ghostBorder,
        style,
      ]}
      {...rest}
    >
      {useGradient ? (
        <LinearGradient
          colors={[...APP_CTA_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientInner, pill && styles.pill, fullWidth && styles.fullWidth]}
          pointerEvents="none"
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  gradientOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 48,
  },
  gradientInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  pill: {
    borderRadius: radius.button,
    minHeight: 54,
    paddingVertical: 16,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 54,
    borderRadius: radius.button,
    paddingVertical: 16,
  },
  primaryFullWidthDepth:
    Platform.OS === 'ios'
      ? {
          shadowColor: '#6C63FF',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
        }
      : { elevation: 5 },
  textAuth: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  ghostBorder: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
