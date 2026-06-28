/**
 * Reusable keyboard-safe wrapper: iOS keyboard-controller KAV + optional typing backdrop.
 */
import { colors } from '@/constants/theme';
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Passed to `KeyboardAvoidingView` (header + status bar stack). */
  keyboardVerticalOffset?: number;
  /** Use keyboard avoidance on iOS (default). Android uses window resize. */
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
  const useKav = avoidKeyboard && Platform.OS === 'ios';

  const body = useKav ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );

  return (
    <View style={[styles.root, style]}>
      {body}
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
