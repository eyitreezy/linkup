/**
 * Flutterwave OTP/PIN is unreliable inside React Native WebView (resets on OTP step).
 * Use system browser / Chrome Custom Tab on all mobile platforms.
 */
export function shouldUseFlutterwaveInAppWebView(): boolean {
  return false;
}
