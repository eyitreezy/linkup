import { MM } from '@/constants/matchmakerTheme';
import { Stack } from 'expo-router';

export default function MatchMakerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: MM.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
