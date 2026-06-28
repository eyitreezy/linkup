/**
 * Form screens — uses react-native-keyboard-controller for reliable cross-platform IME handling.
 * Optional `footer` sticks above the keyboard via KeyboardStickyView (onboarding, plan wizard).
 */
import { KeyboardFormScrollContext } from '@/components/layout/KeyboardFormScrollContext';
import {
  WIZARD_FOOTER_BODY_HEIGHT,
} from '@/lib/keyboard/constants';
import { useKeyboardStickyFooterMode } from '@/hooks/useKeyboardStickyFooterMode';
import React, { forwardRef, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView as ControllerAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type KeyboardSafeScrollViewProps = ScrollViewProps & {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Space between caret and keyboard when focused (default 16). */
  bottomOffset?: number;
  /** Extra scroll padding below content (default 24). */
  extraScrollHeight?: number;
  /** Fixed footer rendered in KeyboardStickyView (moves with keyboard). */
  footer?: React.ReactNode;
};

export const KeyboardSafeScrollView = forwardRef<KeyboardAwareScrollViewRef, KeyboardSafeScrollViewProps>(
  function KeyboardSafeScrollView(
    {
      children,
      contentContainerStyle,
      bottomOffset = 16,
      extraScrollHeight = 24,
      footer,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'interactive',
      showsVerticalScrollIndicator = false,
      style,
      ...scrollViewProps
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const innerRef = useRef<KeyboardAwareScrollViewRef>(null);
    useKeyboardStickyFooterMode(!!footer);
    const footerClearance = footer
      ? WIZARD_FOOTER_BODY_HEIGHT + Math.max(insets.bottom, 16)
      : 0;

    const setRef = useCallback(
      (node: KeyboardAwareScrollViewRef | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref && 'current' in ref) ref.current = node;
      },
      [ref]
    );

    const scrollApi = useMemo(
      () => ({
        scrollFieldIntoView: () => {
          innerRef.current?.assureFocusedInputVisible();
        },
        keyboardVisible: false,
      }),
      []
    );

    return (
      <KeyboardFormScrollContext.Provider value={scrollApi}>
        <View style={styles.flex}>
          <ControllerAwareScrollView
            ref={setRef}
            style={[styles.flex, style]}
            contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
            bottomOffset={bottomOffset + footerClearance}
            extraKeyboardSpace={extraScrollHeight}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            keyboardDismissMode={keyboardDismissMode}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            disableScrollOnKeyboardHide={false}
            {...scrollViewProps}
          >
            {children}
          </ControllerAwareScrollView>
          {footer ? (
            <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={styles.stickyFooter}>
              {footer}
            </KeyboardStickyView>
          ) : null}
        </View>
      </KeyboardFormScrollContext.Provider>
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contentContainer: {
    flexGrow: 1,
  },
  stickyFooter: {
    width: '100%',
  },
});
