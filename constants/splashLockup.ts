/** Splash brand lockup sizing — kept in sync with linkup-web SplashBrandLockup. */
export const SPLASH_LOCKUP_MAX_WIDTH = 320;

/** Matches web `max-w-[86vw]`. */
export const SPLASH_LOCKUP_VW_RATIO = 0.86;

/** splash-brand-lockup.png intrinsic ratio (1024×364). */
export const SPLASH_LOCKUP_HEIGHT_RATIO = 364 / 1024;

export function resolveSplashLockupWidth(viewportWidth: number): number {
  return Math.min(SPLASH_LOCKUP_MAX_WIDTH, Math.round(viewportWidth * SPLASH_LOCKUP_VW_RATIO));
}

export function getSplashLockupMetrics(viewportWidth: number, lockupWidthOverride?: number) {
  const lockupWidth = lockupWidthOverride ?? resolveSplashLockupWidth(viewportWidth);
  return {
    lockupWidth,
    lockupHeight: Math.round(lockupWidth * SPLASH_LOCKUP_HEIGHT_RATIO),
  };
}
