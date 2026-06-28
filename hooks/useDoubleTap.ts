import { useCallback, useEffect, useRef } from 'react';

type Options = {
  onSingle: () => void;
  onDouble: () => void;
  /** Max ms between taps to count as double-tap. */
  delayMs?: number;
};

/** Single tap vs double-tap — delays single until double window closes. */
export function useDoubleTap({ onSingle, onDouble, delayMs = 280 }: Options) {
  const lastTapRef = useRef(0);
  const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singleTimerRef.current) clearTimeout(singleTimerRef.current);
    };
  }, []);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < delayMs) {
      if (singleTimerRef.current) {
        clearTimeout(singleTimerRef.current);
        singleTimerRef.current = null;
      }
      lastTapRef.current = 0;
      onDouble();
      return;
    }

    lastTapRef.current = now;
    singleTimerRef.current = setTimeout(() => {
      singleTimerRef.current = null;
      onSingle();
    }, delayMs);
  }, [delayMs, onDouble, onSingle]);
}
