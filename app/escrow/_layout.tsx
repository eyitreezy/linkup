/**
 * Escrow stack — detail screen and bank-transfer funding flow.
 */
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function EscrowLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.splashBackground },
      }}
    />
  );
}
