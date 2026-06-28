/**
 * Root keyboard wrapper — KAV on iOS only; Android relies on window resize (no ghost gap).
 */
import { keyboardAvoidingBehavior, keyboardAvoidingVerticalOffset } from '@/lib/keyboard/keyboardAvoidingBehavior';
import { KeyboardAvoidingView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
};

export function KeyboardAvoidingRoot({ children, style, keyboardVerticalOffset = 0 }: Props) {
  const behavior = keyboardAvoidingBehavior();
  const offset = keyboardAvoidingVerticalOffset(keyboardVerticalOffset);

  if (!behavior) {
    return <View style={[styles.flex, style]}>{children}</View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.flex, style]} behavior={behavior} keyboardVerticalOffset={offset}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
