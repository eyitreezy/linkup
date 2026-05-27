/**
 * Floating action — create plan (PL1).
 */
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onPress: () => void;
  bottomOffset?: number;
};

export function PlansFab({ onPress, bottomOffset = 88 }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomOffset + insets.bottom }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Suggest a meetup"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const SIZE = 58;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabPressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
});
