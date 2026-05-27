/**
 * ScrollView tuned for forms: taps while keyboard open + iOS automatic inset adjustment.
 */
import React, { forwardRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';

export type KeyboardAwareScrollViewProps = ScrollViewProps;

export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView({ keyboardShouldPersistTaps = 'handled', ...rest }, ref) {
    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        {...rest}
      />
    );
  }
);
