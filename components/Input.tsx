/**
 * Text input with label — forms (login, profile, plans).
 * `variant="auth"` = label-less, dating-app auth styling (placeholders only).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { AuthSheetScrollContext } from '@/components/auth/AuthSheetScrollContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

/** Single-line onboarding fields share this min height (date row + text inputs). */
export const ONBOARDING_FIELD_MIN_HEIGHT = 52;

const PLACEHOLDER_AUTH = '#9CA3AF';
const BORDER_DEFAULT = '#E5E7EB';
const AUTH_MIN_HEIGHT = 54;
const AUTH_RADIUS = 14;

type Props = TextInputProps & {
  label?: string;
  error?: string;
  /**
   * `soft` = legacy auth grey fill.
   * `auth` = modern auth (no label, placeholder-only, premium border + focus).
   * `onboarding` / `onboardingFlat` = profile & plans.
   */
  variant?: 'default' | 'soft' | 'auth' | 'onboarding' | 'onboardingFlat';
  passwordToggle?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

/** @deprecated Prefer `variant="auth"` for new auth screens. */
export const authSoftLabelStyle = {
  fontSize: 12 as const,
  fontWeight: '600' as const,
  color: colors.text,
  letterSpacing: 0.3,
  marginBottom: spacing.sm,
};

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

export function onboardingTouchableFieldStyle(extra?: StyleProp<ViewStyle>) {
  return [onboardingFieldChrome, onboardingInputShadow, extra];
}

export function planCreateTouchableFieldStyle(extra?: StyleProp<ViewStyle>) {
  return [onboardingFieldChrome, extra];
}

function useFocusPulse(focused: boolean) {
  const pulse = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(pulse, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused, pulse]);
  return pulse;
}

export function Input({
  label,
  error,
  style,
  containerStyle,
  variant = 'soft',
  multiline,
  passwordToggle,
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [passwordHidden, setPasswordHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const focusPulse = useFocusPulse(focused);
  const focusScale = useRef(new Animated.Value(1)).current;
  const authFieldGroupRef = useRef<View>(null);
  const authSheetScroll = useContext(AuthSheetScrollContext);

  const scrollAuthFieldIntoView = useCallback(() => {
    if (!authSheetScroll || !authFieldGroupRef.current) return;
    authSheetScroll.scrollFieldIntoView(authFieldGroupRef);
  }, [authSheetScroll]);

  const labelStyle =
    variant === 'onboarding' || variant === 'onboardingFlat' || variant === 'soft'
      ? styles.labelSoft
      : styles.label;
  const onboardingLike = variant === 'onboarding' || variant === 'onboardingFlat';
  const isAuth = variant === 'auth';
  const effectiveSecure = passwordToggle ? passwordHidden : !!secureTextEntry;

  useEffect(() => {
    if (!onboardingLike) return;
    Animated.spring(focusScale, {
      toValue: fieldFocused ? 1.02 : 1,
      friction: 8,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [fieldFocused, focusScale, onboardingLike]);

  const handleFieldFocus = useCallback(
    (e: Parameters<NonNullable<React.ComponentProps<typeof TextInput>['onFocus']>>[0]) => {
      if (onboardingLike) setFieldFocused(true);
      onFocus?.(e);
    },
    [onboardingLike, onFocus]
  );

  const handleFieldBlur = useCallback(
    (e: Parameters<NonNullable<React.ComponentProps<typeof TextInput>['onBlur']>>[0]) => {
      if (onboardingLike) setFieldFocused(false);
      onBlur?.(e);
    },
    [onboardingLike, onBlur]
  );

  const borderColorAnimated = focusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? colors.danger : BORDER_DEFAULT, error ? colors.danger : colors.primary],
  });

  const authShadowOpacity = focusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.22],
  });

  const inputChrome = [
    styles.input,
    variant === 'soft' && styles.inputSoft,
    onboardingLike && styles.inputOnboarding,
    variant === 'onboarding' && onboardingInputShadow,
    multiline && variant === 'soft' && styles.inputSoftMultiline,
    multiline && onboardingLike && styles.inputOnboardingMultiline,
    multiline && variant === 'default' && styles.inputDefaultMultiline,
    error ? styles.inputErr : null,
    style,
  ];

  const showLabel = !!label && !isAuth;

  if (isAuth && passwordToggle && !multiline) {
    return (
      <View ref={authFieldGroupRef} collapsable={false} style={styles.wrapAuth}>
        <Animated.View
          style={[
            styles.authFieldRow,
            Platform.OS === 'ios' && {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: authShadowOpacity,
              shadowRadius: 10,
            },
            Platform.OS === 'android' && { elevation: focused ? 3 : error ? 2 : 0 },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 1.5,
                borderColor: borderColorAnimated,
                borderRadius: AUTH_RADIUS,
              },
            ]}
          />
          <TextInput
            placeholderTextColor={PLACEHOLDER_AUTH}
            style={styles.authPasswordInput}
            multiline={false}
            secureTextEntry={effectiveSecure}
            textContentType="password"
            autoCorrect={false}
            onFocus={(e) => {
              setFocused(true);
              scrollAuthFieldIntoView();
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? 'Show password' : 'Hide password'}
            hitSlop={12}
            onPress={() => setPasswordHidden((h) => !h)}
            style={({ pressed }) => [styles.authEye, pressed && { opacity: 0.65 }]}
          >
            <Ionicons
              name={passwordHidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={focused ? colors.primary : PLACEHOLDER_AUTH}
            />
          </Pressable>
        </Animated.View>
        {error ? <Text style={styles.errAuth}>{error}</Text> : null}
      </View>
    );
  }

  if (isAuth && !multiline) {
    return (
      <View ref={authFieldGroupRef} collapsable={false} style={styles.wrapAuth}>
        <Animated.View
          style={[
            styles.authFieldPlain,
            Platform.OS === 'ios' && {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: authShadowOpacity,
              shadowRadius: 10,
            },
            Platform.OS === 'android' && { elevation: focused ? 3 : error ? 2 : 0 },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 1.5,
                borderColor: borderColorAnimated,
                borderRadius: AUTH_RADIUS,
              },
            ]}
          />
          <TextInput
            placeholderTextColor={PLACEHOLDER_AUTH}
            style={styles.authTextInput}
            multiline={false}
            secureTextEntry={effectiveSecure}
            onFocus={(e) => {
              setFocused(true);
              scrollAuthFieldIntoView();
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
        </Animated.View>
        {error ? <Text style={styles.errAuth}>{error}</Text> : null}
      </View>
    );
  }

  const FormWrap = onboardingLike ? Animated.View : View;

  return (
    <FormWrap
      style={[styles.wrap, containerStyle, onboardingLike && { transform: [{ scale: focusScale }] }]}
    >
      {showLabel ? <Text style={labelStyle}>{label}</Text> : null}
      {passwordToggle && !multiline ? (
        <View
          style={[
            styles.passwordRow,
            variant === 'soft' && styles.passwordRowSoft,
            onboardingLike && styles.passwordRowOnboarding,
            variant === 'onboarding' && onboardingInputShadow,
            error ? styles.inputErr : null,
          ]}
        >
          <TextInput
            placeholderTextColor={colors.textMuted}
            style={[styles.passwordField, variant === 'soft' && styles.passwordFieldSoft]}
            multiline={false}
            secureTextEntry={effectiveSecure}
            textContentType="password"
            autoCorrect={false}
            onFocus={handleFieldFocus}
            onBlur={handleFieldBlur}
            {...rest}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? 'Show password' : 'Hide password'}
            hitSlop={12}
            onPress={() => setPasswordHidden((h) => !h)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}
          >
            <Ionicons
              name={passwordHidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
      ) : (
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={inputChrome}
          multiline={multiline}
          secureTextEntry={effectiveSecure}
          onFocus={handleFieldFocus}
          onBlur={handleFieldBlur}
          {...rest}
        />
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </FormWrap>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  wrapAuth: { marginBottom: 14 },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  labelSoft: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
  },
  authFieldPlain: {
    backgroundColor: '#F8F8FC',
    borderRadius: AUTH_RADIUS,
    minHeight: AUTH_MIN_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FC',
    borderRadius: AUTH_RADIUS,
    minHeight: AUTH_MIN_HEIGHT,
    overflow: 'hidden',
  },
  authTextInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    minHeight: AUTH_MIN_HEIGHT,
    letterSpacing: -0.2,
  },
  authPasswordInput: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    minHeight: AUTH_MIN_HEIGHT,
    letterSpacing: -0.2,
  },
  authEye: {
    paddingRight: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  errAuth: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
  },
  passwordRowSoft: {
    borderWidth: 0,
    backgroundColor: colors.authInputBg,
    borderRadius: radius.lg,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
  },
  passwordRowOnboarding: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
  },
  passwordField: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  passwordFieldSoft: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  passwordToggle: {
    paddingRight: spacing.md,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  passwordTogglePressed: { opacity: 0.7 },
  err: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
});
