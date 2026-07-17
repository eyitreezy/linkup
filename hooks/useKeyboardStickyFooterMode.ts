/**
 * Screens with KeyboardStickyView bottom chrome (chat composer, wizard footers).
 * On Android, disable window resize so sticky translate is the only lift — avoids
 * double compensation and ghost gaps with manifest `adjustResize`.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { AndroidSoftInputModes, KeyboardController } from 'react-native-keyboard-controller';

export function useKeyboardStickyFooterMode(active = true) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (active) {
      KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    } else {
      KeyboardController.setDefaultMode();
    }
    return () => {
      if (active) KeyboardController.setDefaultMode();
    };
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      if (!active || Platform.OS !== 'android') return undefined;
      KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
      return () => {
        KeyboardController.setDefaultMode();
      };
    }, [active])
  );
}
