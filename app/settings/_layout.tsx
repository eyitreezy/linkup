import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '800' },
        ...(Platform.OS === 'android'
          ? { statusBarTranslucent: false, headerTopInsetEnabled: false }
          : null),
      }}
    >
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile', headerShown: false }} />
      <Stack.Screen name="verification" options={{ title: 'Verification' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications & visibility', headerShown: false }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy & safety', headerShown: false }} />
      <Stack.Screen name="travel" options={{ title: 'Travel mode', headerShown: false }} />
      <Stack.Screen name="plan-management" options={{ title: 'Plan management' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account', headerShown: false }} />
    </Stack>
  );
}
