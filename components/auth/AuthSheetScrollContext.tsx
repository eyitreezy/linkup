/**
 * Login/signup sheet scroll: brings the focused field to just above the keyboard.
 */
import { createContext, useContext, type RefObject } from 'react';
import { View } from 'react-native';

export type AuthSheetScrollAPI = {
  scrollFieldIntoView: (fieldRef: RefObject<View | null>) => void;
};

export const AuthSheetScrollContext = createContext<AuthSheetScrollAPI | null>(null);

export function useAuthSheetScroll(): AuthSheetScrollAPI | null {
  return useContext(AuthSheetScrollContext);
}
