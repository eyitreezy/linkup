/**
 * Text input with label — forms (login, profile, plans).
 */
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

/** Single-line onboarding fields share this min height (date row + text inputs). */
export const ONBOARDING_FIELD_MIN_HEIGHT = 52;

type Props = TextInputProps & {
  label?: string;
  error?: string;
  /** `soft` = auth screens (grey fill). `onboarding` = white + border + soft shadow. `onboardingFlat` = same border/fill, no shadow (plan create). */
  variant?: 'default' | 'soft' | 'onboarding' | 'onboardingFlat';
};

/** Matches sign-in / sign-up fields (`variant="soft"`) — use for date/time row labels to align with `Input`. */
export const authSoftLabelStyle = {
  fontSize: 12 as const,
  fontWeight: '600' as const,
  color: colors.text,
  letterSpacing: 0.3,
  marginBottom: spacing.xs,
};

/** Very soft elevation for white onboarding/plan fields — readable, not “floating card”. */
export const onboardingInputShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.035,
        shadowRadius: 5,
      }
    : { elevation: 1 };

const onboardingFieldChrome = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: '#D8DCE6',
  borderRadius: radius.lg,
  paddingHorizontal: spacing.md,
  minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
  justifyContent: 'center' as const,
};

/** Pressable row matching `Input` `variant="onboarding"` (e.g. date picker trigger). */
export function onboardingTouchableFieldStyle(extra?: StyleProp<ViewStyle>) {
  return [onboardingFieldChrome, onboardingInputShadow, extra];
}

/** Plan create / flat white fields: grey border only, no shadow. */
export function planCreateTouchableFieldStyle(extra?: StyleProp<ViewStyle>) {
  return [onboardingFieldChrome, extra];
}

export function Input({ label, error, style, variant = 'soft', multiline, ...rest }: Props) {
  const labelStyle =
    variant === 'onboarding' || variant === 'onboardingFlat' || variant === 'soft'
      ? styles.labelSoft
      : styles.label;
  const onboardingLike = variant === 'onboarding' || variant === 'onboardingFlat';
  return (
    <View style={styles.wrap}>
      {label ? <Text style={labelStyle}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          variant === 'soft' && styles.inputSoft,
          onboardingLike && styles.inputOnboarding,
          variant === 'onboarding' && onboardingInputShadow,
          multiline && variant === 'soft' && styles.inputSoftMultiline,
          multiline && onboardingLike && styles.inputOnboardingMultiline,
          multiline && variant === 'default' && styles.inputDefaultMultiline,
          error ? styles.inputErr : null,
          style,
        ]}
        multiline={multiline}
        {...rest}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  labelSoft: { fontSize: 12, fontWeight: '600', color: colors.text, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputSoft: {
    borderWidth: 0,
    backgroundColor: colors.authInputBg,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  inputOnboarding: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
  },
  inputSoftMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  inputDefaultMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  inputOnboardingMultiline: {
    minHeight: 128,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  inputErr: { borderColor: colors.danger },
  err: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
});
