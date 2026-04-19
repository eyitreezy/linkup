/**
 * Safe area + scroll wrapper for screens.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

/** No top by default — native stack headers and many modals already inset; tab roots pass `top` explicitly. */
const defaultSafeEdges: Edge[] = ['left', 'right'];

type Props = ViewProps & {
  scroll?: boolean;
  /** Merged after default scroll padding (e.g. tighter top inset to match feed). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Safe-area padding. Include `top` for headerless screens (tabs, custom in-screen headers).
   * Stacks with a native header should keep the default (no top) to avoid a double band.
   */
  safeAreaEdges?: Edge[];
  children: React.ReactNode;
};

export function Screen({
  scroll,
  contentContainerStyle,
  safeAreaEdges = defaultSafeEdges,
  children,
  style,
  ...rest
}: Props) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={safeAreaEdges}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.fill, style]} {...rest}>
          {body}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
});
