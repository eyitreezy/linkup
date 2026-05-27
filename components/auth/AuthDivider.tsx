/**
 * Visual separator between email form and other sign-in methods.
 */
import { colors, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export function AuthDivider({
  label = 'Or continue with email',
  tone = 'light',
}: {
  label?: string;
  tone?: 'light' | 'glass';
}) {
  const glass = tone === 'glass';
  return (
    <View style={styles.row}>
      <View style={[styles.line, glass && styles.lineGlass]} />
      <Text style={[styles.text, glass && styles.textGlass]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.line, glass && styles.lineGlass]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(26, 29, 38, 0.08)', maxHeight: 1 },
  lineGlass: { backgroundColor: 'rgba(255,255,255,0.18)' },
  text: {
    flexShrink: 0,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
    opacity: 0.92,
  },
  textGlass: { color: 'rgba(255,255,255,0.55)' },
});
