/**
 * Reliable back for nested plan stack — default header back can fail to receive presses on some setups.
 */
import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { goToDiscoveryFeed } from '@/lib/navigation/goToDiscoveryFeed';
import { router } from 'expo-router';
import { Pressable, Platform, StyleSheet } from 'react-native';

export function PlanStackHeaderBack() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else goToDiscoveryFeed();
      }}
      hitSlop={12}
      style={({ pressed }) => [styles.hit, pressed && styles.hitPressed]}
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    paddingVertical: Platform.OS === 'android' ? 6 : 8,
    paddingHorizontal: 8,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  hitPressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
  },
});
