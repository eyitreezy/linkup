import { Platform } from 'react-native';

/**
 * iOS: padding-based KAV (adds/removes padding cleanly on dismiss).
 * Android: undefined — `windowSoftInputMode="adjustResize"` in app.config / manifest handles IME.
 */
export function keyboardAvoidingBehavior(): 'padding' | undefined {
  return Platform.OS === 'ios' ? 'padding' : undefined;
}

export function keyboardAvoidingVerticalOffset(headerOrCustomOffset: number): number {
  return Platform.OS === 'ios' ? headerOrCustomOffset : 0;
}

export const isIosKeyboardAvoidance = Platform.OS === 'ios';
