import { colors } from '@/constants/theme';

/** Selection chips / pills (edit profile, create plan, filters). */
export const APP_CHIP_GRADIENT = [colors.primary, '#7568FF', colors.secondary] as const;

/** Primary CTAs (publish, continue, apply). */
export const APP_CTA_GRADIENT = [colors.primary, colors.secondary] as const;

/** Solid app shell backdrop — branded splash tone, used app-wide. */
export const APP_SHELL_BACKGROUND_GRADIENT = [
  colors.splashBackground,
  colors.splashBackground,
  colors.splashBackground,
  colors.splashBackground,
] as const;

/** App shell backdrop — solid splash background across screens. */
export const DISCOVERY_SHELL_GRADIENT = APP_SHELL_BACKGROUND_GRADIENT;

export const DISCOVERY_SHELL_GRADIENT_LOCATIONS = [0, 0.32, 0.62, 1] as const;

/** Plan wizard screens — solid splash background. */
export const PLAN_WIZARD_GRADIENT = APP_SHELL_BACKGROUND_GRADIENT;

/** Legacy vivid lavender → rose → mint → blush shell (chat "Lavender" wallpaper). */
export const CHAT_LAVENDER_WALLPAPER_GRADIENT = [
  colors.discoveryShellLavender,
  colors.discoveryShellRose,
  colors.discoveryShellMint,
  colors.discoveryGradientBottom,
] as const;
