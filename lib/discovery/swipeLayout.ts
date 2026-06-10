import { spacing } from '@/constants/theme';

/** Largest action control in `SwipeActionButtons` (like). */
export const SWIPE_ACTION_BUTTON_SIZE = 68;

/** Vertical padding inside the action button row. */
export const SWIPE_ACTION_ROW_PAD_Y = spacing.xs;

/** Fixed action bar content height (row only — tab bar inset is applied separately). */
export const SWIPE_ACTION_BAR_HEIGHT = SWIPE_ACTION_BUTTON_SIZE + SWIPE_ACTION_ROW_PAD_Y * 2;

/** Bottom clearance for the discover FAB when swipe actions are visible. */
export function swipeFabBottomOffset(tabBarInset: number): number {
  return tabBarInset + SWIPE_ACTION_BAR_HEIGHT + spacing.xs + spacing.sm;
}
