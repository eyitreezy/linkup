/** Splash brand lockup sizing — kept in sync with linkup-web SplashBrandLockup. */
export const SPLASH_LOGO_MAX_WIDTH = 320;

/** Matches web `max-w-[86vw]`. */
export const SPLASH_LOGO_VW_RATIO = 0.86;

/** splash-brand-logo.png intrinsic ratio (301×103). */
export const SPLASH_LOGO_HEIGHT_RATIO = 103 / 301;

/** Tagline starts under the “link” portion of the wordmark. */
export const SPLASH_TAGLINE_INSET_RATIO = 0.31;

export function resolveSplashLogoWidth(viewportWidth: number): number {
  return Math.min(SPLASH_LOGO_MAX_WIDTH, Math.round(viewportWidth * SPLASH_LOGO_VW_RATIO));
}

export function getSplashLockupMetrics(viewportWidth: number, logoWidthOverride?: number) {
  const logoWidth = logoWidthOverride ?? resolveSplashLogoWidth(viewportWidth);
  return {
    logoWidth,
    logoHeight: Math.round(logoWidth * SPLASH_LOGO_HEIGHT_RATIO),
    taglineInset: Math.round(logoWidth * SPLASH_TAGLINE_INSET_RATIO),
  };
}
