import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

export type KeyboardMetrics = {
  keyboardHeight: number;
  keyboardVisible: boolean;
  /** Y coordinate of the top edge of the keyboard in window space. */
  keyboardTop: number | null;
};

export function useKeyboardMetrics(): KeyboardMetrics {
  const [metrics, setMetrics] = useState<KeyboardMetrics>({
    keyboardHeight: 0,
    keyboardVisible: false,
    keyboardTop: null,
  });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates.height;
      const screenY = e.endCoordinates.screenY;
      setMetrics({
        keyboardHeight: height,
        keyboardVisible: true,
        keyboardTop: typeof screenY === 'number' ? screenY : null,
      });
    };

    const onHide = () => {
      setMetrics({ keyboardHeight: 0, keyboardVisible: false, keyboardTop: null });
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return metrics;
}
