/**
 * Root layout — auth provider, navigation stack, theme header defaults.
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationInboxProvider } from '@/contexts/NotificationInboxContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PresenceProvider>
        <NotificationInboxProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              /** All top-level routes use in-screen or nested stack headers — a default native header adds a second top band (gap under status bar) on plan, chat, etc. */
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="notifications" />
          </Stack>
        </NotificationInboxProvider>
        </PresenceProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
