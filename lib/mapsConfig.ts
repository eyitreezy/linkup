/**
 * Google Maps API keys — one restricted key per platform from Google Cloud Console.
 * Use getMapsApiKeyForCurrentPlatform() when loading Maps JavaScript API on web or map libs that need a key in JS.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  googleMapsAndroidApiKey?: string;
  googleMapsIosApiKey?: string;
  googleMapsWebApiKey?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function getMapsApiKeyForCurrentPlatform(): string {
  const e = extra();
  if (Platform.OS === 'android') {
    return (
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ??
      e.googleMapsAndroidApiKey ??
      ''
    );
  }
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? e.googleMapsIosApiKey ?? '';
  }
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? e.googleMapsWebApiKey ?? '';
}
