/**
 * Reusable keyboard-safe wrapper: KAV + optional typing backdrop (pass `backdropStyle` from `useKeyboardAnimation`).
 */
import { colors } from '@/constants/theme';
import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Passed to React Native `KeyboardAvoidingView` (header + status bar stack). */
  keyboardVerticalOffset?: number;
  /** Use `padding` on iOS (default). */
  avoidKeyboard?: boolean;
  /** From `useKeyboardAnimation().typingBackdropStyle` — subtle dim while IME is open. */
  backdropStyle?: Record<string, unknown>;
};

export function KeyboardAwareContainer({
  children,
  style,
  keyboardVerticalOffset = 0,
  avoidKeyboard = true,
  backdropStyle,
}: Props) {
  const avoid = avoidKeyboard && Platform.OS === 'ios';

  return (
    <View style={[styles.root, style]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={avoid ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
      {backdropStyle ? (
        <Animated.View pointerEvents="none" style={[styles.dimOverlay, backdropStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    zIndex: 4,
  },
});
