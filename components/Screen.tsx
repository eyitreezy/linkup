/**
 * Safe area + scroll wrapper for screens.
 */
import { KeyboardAwareContainer } from '@/components/KeyboardAwareContainer';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
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
  /** Applied to the outer `SafeAreaView` (e.g. transparent for gradient roots). */
  safeAreaStyle?: StyleProp<ViewStyle>;
  /** Subtle dim while typing (pass-through to keyboard stack). */
  dimBackdrop?: boolean;
  /**
   * Extra offset for `KeyboardAwareContainer` beyond safe-area top when `top` is in `safeAreaEdges`.
   * Header row / segmented control chrome that sits below the status bar (~44–56).
   */
  keyboardExtraOffset?: number;
  children: React.ReactNode;
};

export function Screen({
  scroll,
  contentContainerStyle,
  safeAreaEdges = defaultSafeEdges,
  safeAreaStyle,
  dimBackdrop = false,
  keyboardExtraOffset = 0,
  children,
  style,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();
  const { typingBackdropStyle } = useKeyboardAnimation({ enabled: dimBackdrop });
  const hasTopInset = safeAreaEdges.includes('top');
  const keyboardVerticalOffset = (hasTopInset ? insets.top : 0) + keyboardExtraOffset;

  const body = scroll ? (
    <KeyboardAwareScrollView
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      keyboardDismissMode="on-drag"
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, safeAreaStyle]} edges={safeAreaEdges}>
      <KeyboardAwareContainer
        keyboardVerticalOffset={keyboardVerticalOffset}
        backdropStyle={dimBackdrop ? typingBackdropStyle : undefined}
        style={styles.fill}
      >
        <View style={[styles.fill, style]} {...rest}>
          {body}
        </View>
      </KeyboardAwareContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
});
