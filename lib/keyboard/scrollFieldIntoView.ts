import { FIELD_ABOVE_KEYBOARD_PAD, KEYBOARD_SCROLL_RETRY_MS } from '@/lib/keyboard/constants';
import type { RefObject } from 'react';
import { Dimensions, View, type ScrollView } from 'react-native';

export function createScrollFieldIntoView(
  scrollRef: RefObject<ScrollView | null>,
  getScrollOffset: () => number,
  getKeyboardMetrics: () => { keyboardHeight: number; keyboardTop: number | null }
) {
  let pendingFieldRef: RefObject<View | null> | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let raf: number | null = null;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (raf != null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };

  const run = () => {
    const scrollView = scrollRef.current;
    const field = pendingFieldRef?.current;
    if (!scrollView || !field) return;

    const { keyboardHeight, keyboardTop } = getKeyboardMetrics();
    const windowHeight = Dimensions.get('window').height;
    const resolvedKeyboardTop =
      keyboardTop ?? (keyboardHeight > 0 ? windowHeight - keyboardHeight : windowHeight);

    const scrollMeasurable = scrollView as unknown as View;
    scrollMeasurable.measureInWindow((_sx, sy, _sw, sh) => {
      const visibleBottom = Math.min(sy + sh, resolvedKeyboardTop) - FIELD_ABOVE_KEYBOARD_PAD;

      field.measureInWindow((_fx, fy, _fw, fh) => {
        const fieldBottom = fy + fh;
        if (fieldBottom <= visibleBottom) return;

        const overlap = fieldBottom - visibleBottom;
        scrollView.scrollTo({
          y: Math.max(0, getScrollOffset() + overlap),
          animated: true,
        });
      });
    });
  };

  const schedule = () => {
    clearTimers();
    raf = requestAnimationFrame(run);
    KEYBOARD_SCROLL_RETRY_MS.forEach((delay) => {
      timers.push(setTimeout(run, delay));
    });
  };

  return {
    scrollFieldIntoView(fieldRef: RefObject<View | null>) {
      pendingFieldRef = fieldRef;
      schedule();
    },
    retryPendingField() {
      if (pendingFieldRef?.current) schedule();
    },
    clearTimers,
  };
}
