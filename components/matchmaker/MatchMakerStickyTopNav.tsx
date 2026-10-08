/**
 * MatchMaker screens — back row matching edit-profile pill layout with MM tokens.
 */
import { MM, radius, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View, type ReactNode } from 'react-native';

type Props = {
  onBack?: () => void;
  right?: ReactNode;
};

export function MatchMakerStickyTopNav({ onBack, right }: Props) {
  return (
    <View style={styles.topNav}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={MM.text} />
      </Pressable>
      {right ?? <View style={styles.topNavSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topNavSpacer: { width: 44, height: 44 },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MM.surface,
    borderWidth: 1,
    borderColor: 'rgba(155, 27, 75, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: MM.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
});
