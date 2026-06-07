/**
 * Root layout — auth provider, navigation stack, theme header defaults.
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthDeepLinkBootstrap } from '@/components/auth/AuthDeepLinkBootstrap';
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
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthDeepLinkBootstrap />
          <AuthPasswordRecoveryBootstrap />
          <PushTokenSyncBootstrap />
          <PresenceProvider>
            <NotificationInboxProvider>
              <SplashGate>
                <Stack
                  screenOptions={{
                    /** All top-level routes use in-screen or nested stack headers — a default native header adds a second top band (gap under status bar) on plan, chat, etc. */
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                  }}
                >
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="notifications" />
                </Stack>
              </SplashGate>
            </NotificationInboxProvider>
          </PresenceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
