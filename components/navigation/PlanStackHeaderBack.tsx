/**
 * Reliable back for nested plan stack — default header back can fail to receive presses on some setups.
 */
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Platform } from 'react-native';

export function PlanStackHeaderBack() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)' as Href);
      }}
      hitSlop={12}
      style={{
        paddingVertical: Platform.OS === 'android' ? 4 : 8,
        paddingLeft: Platform.OS === 'android' ? 4 : 0,
        paddingRight: 10,
        justifyContent: 'center',
      }}
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
