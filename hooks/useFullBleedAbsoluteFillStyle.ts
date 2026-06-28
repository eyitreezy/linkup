import { useMemo } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Extend absolute-fill backgrounds under status bar / nav bar on edge-to-edge Android. */
export function useFullBleedAbsoluteFillStyle(): ViewStyle {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => ({
      ...StyleSheet.absoluteFillObject,
      top: -insets.top,
      bottom: -insets.bottom,
      left: -insets.left,
      right: -insets.right,
    }),
    [insets.top, insets.bottom, insets.left, insets.right]
  );
}
