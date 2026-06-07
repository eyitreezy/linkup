import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  topInset: number;
  title?: string;
  helpHref?: Href;
};

export function EscrowScreenHeader({ topInset, title = 'Secure payment', helpHref = '/support' }: Props) {
  return (
    <View style={[styles.wrap, { paddingTop: Math.max(topInset, spacing.xs) }]}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        onPress={() => router.push(helpHref)}
        style={({ pressed }) => [styles.helpPill, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Help"
      >
        <Text style={styles.helpTxt}>Help</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.2,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: { shadowColor: '#1A1D26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  helpPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  helpTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  pressed: { opacity: 0.92 },
});
