/**
 * Plan routes — create wizard + dynamic [id] stack.
 */
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function PlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
