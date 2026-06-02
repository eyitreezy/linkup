/**
 * Single Expo config (no app.json) — env-driven Maps keys + EAS env extras.
 * New Architecture is enabled in android/gradle.properties (newArchEnabled=true).
 */
/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'LinkUp',
    slug: 'linkup',
    owner: 'kingdan1',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'linkup',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F5F6FA',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.linkup.app',
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? '',
      },
    },
    android: {
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#6C63FF',
      },
      package: 'com.linkup.app',
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? '',
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-dev-client',
      '@react-native-community/datetimepicker',
      'expo-router',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'LinkUp uses your location to suggest nearby plans.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'LinkUp uses your camera to scan your ID and record a short verification video.',
          microphonePermission: 'LinkUp uses your microphone for a brief liveness video.',
          recordAudioAndroid: true,
        },
      ],
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#6C63FF',
          sounds: [],
          mode: 'production',
        },
      ],
      'expo-video',
      [
        'expo-calendar',
        {
          calendarPermission:
            'LinkUp can add meetups you choose to your calendar for reminders.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '3ea775d4-aba3-4588-b90d-b720dab6c4b1',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      paystackPublicKey: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ?? '',
      appUrl: process.env.EXPO_PUBLIC_URL ?? '',
      authRedirectUrl: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? '',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
      phoneDefaultDialCode: process.env.EXPO_PUBLIC_PHONE_DEFAULT_DIAL_CODE ?? '',
      googleMapsAndroidApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? '',
      googleMapsIosApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? '',
      googleMapsWebApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '',
    },
  },
};
