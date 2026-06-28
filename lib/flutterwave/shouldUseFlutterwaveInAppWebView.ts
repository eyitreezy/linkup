import { Platform } from 'react-native';

/**
 * Android release/preview APKs often render a blank Flutterwave page inside WebView
 * (GPU compositing + edge-to-edge). Emulators and iOS use the in-app modal.
 */
export function shouldUseFlutterwaveInAppWebView(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android' && __DEV__) return true;
  return false;
}
