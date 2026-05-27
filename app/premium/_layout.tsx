import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function PremiumLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Premium' }} />
      <Stack.Screen name="checkout" options={{ headerShown: false, title: 'Checkout' }} />
      <Stack.Screen name="success" options={{ title: '', headerShown: false }} />
    </Stack>
  );
}
