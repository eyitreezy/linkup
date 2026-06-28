/**
 * ScrollView for use inside KeyboardAvoidingView — no auto keyboard insets (prevents ghost space).
 */
import React, { forwardRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';

export type KeyboardAwareScrollViewProps = ScrollViewProps;

export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode,
      showsVerticalScrollIndicator = false,
      style,
      automaticallyAdjustKeyboardInsets: _ignoredAuto,
      contentInsetAdjustmentBehavior: _ignoredInset,
      contentInset: _ignoredContentInset,
      contentOffset: _ignoredContentOffset,
      ...rest
    },
    ref
  ) {
    return (
      <ScrollView
        ref={ref}
        {...rest}
        style={style}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior="never"
      />
    );
  }
);
