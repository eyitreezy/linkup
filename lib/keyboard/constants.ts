import { Platform } from 'react-native';

export const FIELD_ABOVE_KEYBOARD_PAD = 16;

export const KEYBOARD_SCROLL_RETRY_MS =
  Platform.OS === 'ios' ? [80, 180, 320] : [50, 120, 220, 360];

/** Approximate height of wizard/onboarding glass footer (button + padding, excluding safe area). */
export const WIZARD_FOOTER_BODY_HEIGHT = 56 + 16 + 32;

/** Space below last bubble when keyboard is closed (composer is a sibling below the list). */
export const CHAT_LIST_BOTTOM_PAD = 8;
