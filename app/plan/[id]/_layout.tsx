/**
 * Plan detail stack — PL4 overview, PL5 negotiation, PL6 agreement.
 * Native headers are off for plan/interest/negotiate; each screen uses PlanStackScreenHeader (home-style top inset).
 */
import { GroupPlanPolicyGateLayout } from '@/components/plans/GroupPlanPolicyGateLayout';
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function PlanIdLayout() {
  return (
    <GroupPlanPolicyGateLayout>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.splashBackground },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="preview" />
        <Stack.Screen name="interest" />
        <Stack.Screen name="negotiate" />
        <Stack.Screen name="agreement" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" />
        <Stack.Screen name="minimum-action" />
        <Stack.Screen name="review" />
        <Stack.Screen name="invitation/[invitationId]" />
      </Stack>
    </GroupPlanPolicyGateLayout>
  );
}
