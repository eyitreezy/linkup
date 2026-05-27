/**
 * PL1–PL3 — structured create plan wizard.
 */
import { PlanDraftProvider } from '@/contexts/PlanDraftContext';
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function CreatePlanStack() {
  return (
    <PlanDraftProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          ...(Platform.OS === 'android'
            ? { statusBarTranslucent: false, headerTopInsetEnabled: false }
            : null),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="commitment" options={{ headerShown: false }} />
        <Stack.Screen name="details" options={{ headerShown: false }} />
        <Stack.Screen name="success" options={{ title: 'Live', headerBackVisible: false }} />
      </Stack>
    </PlanDraftProvider>
  );
}
