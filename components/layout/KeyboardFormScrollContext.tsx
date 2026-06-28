import { createContext, useContext, type RefObject } from 'react';

export type KeyboardFormScrollAPI = {
  scrollFieldIntoView: (fieldRef?: RefObject<unknown>) => void;
  keyboardVisible: boolean;
};

export const KeyboardFormScrollContext = createContext<KeyboardFormScrollAPI | null>(null);

export function useKeyboardFormScroll(): KeyboardFormScrollAPI | null {
  return useContext(KeyboardFormScrollContext);
}
