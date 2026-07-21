/**
 * Root layout — auth provider, navigation stack, theme header defaults.
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Poppins_500Medium } from '@expo-google-fonts/poppins';
import { AuthDeepLinkBootstrap } from '@/components/auth/AuthDeepLinkBootstrap';
import { PlanDeepLinkBootstrap } from '@/components/plans/PlanDeepLinkBootstrap';
import { AuthPasswordRecoveryBootstrap } from '@/components/auth/AuthPasswordRecoveryBootstrap';
import { PushTokenSyncBootstrap } from '@/components/notifications/PushTokenSyncBootstrap';
import { SplashGate } from '@/components/splash/SplashGate';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationInboxProvider } from '@/contexts/NotificationInboxContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

/** RN 0.83+ deprecates core SafeAreaView; some dev tools / deps still mount it. App screens use safe-area-context. */
if (__DEV__) {
  LogBox.ignoreLogs([
    'SafeAreaView has been deprecated',
    "Please use 'react-native-safe-area-context' instead",
  ]);
  const origWarn = console.warn;
  console.warn = (...args: Parameters<typeof console.warn>) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('SafeAreaView has been deprecated')) return;
    origWarn(...args);
  };
}

function RootNavigator() {
  return (
    <SplashGate>
      <Stack
        screenOptions={{
          /** All top-level routes use in-screen or nested stack headers — a default native header adds a second top band (gap under status bar) on plan, chat, etc. */
          headerShown: false,
          contentStyle: { backgroundColor: colors.splashBackground },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="escrow" options={{ headerShown: false }} />
        <Stack.Screen name="wallet" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" />
      </Stack>
    </SplashGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_800ExtraBold,
    Poppins_500Medium,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider preload={false}>
          <AuthProvider>
          <AuthDeepLinkBootstrap />
          <PlanDeepLinkBootstrap />
          <AuthPasswordRecoveryBootstrap />
          <PushTokenSyncBootstrap />
          <PresenceProvider>
            <NotificationInboxProvider>
              <RootNavigator />
            </NotificationInboxProvider>
          </PresenceProvider>
        </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
