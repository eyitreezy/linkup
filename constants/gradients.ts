import { colors } from '@/constants/theme';

/** Selection chips / pills (edit profile, create plan, filters). */
export const APP_CHIP_GRADIENT = [colors.primary, '#7568FF', colors.secondary] as const;

/** Primary CTAs (publish, continue, apply). */
export const APP_CTA_GRADIENT = [colors.primary, colors.secondary] as const;

/** App shell backdrop — vivid lavender → rose → mint → blush. */
export const DISCOVERY_SHELL_GRADIENT = [
  colors.discoveryShellLavender,
  colors.discoveryShellRose,
  colors.discoveryShellMint,
  colors.discoveryGradientBottom,
] as const;

export const DISCOVERY_SHELL_GRADIENT_LOCATIONS = [0, 0.32, 0.62, 1] as const;

/** Plan wizard screens — same stops, ends on neutral background. */
export const PLAN_WIZARD_GRADIENT = [
  colors.discoveryShellLavender,
  colors.discoveryShellRose,
  colors.discoveryShellMint,
  colors.background,
] as const;
