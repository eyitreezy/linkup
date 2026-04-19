/**
 * Centered loading / empty-in-progress state for plan detail routes.
 */
import { colors, spacing } from '@/constants/theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string;
  subtitle?: string;
};

export function PlanScreenLoading({
  title = 'Loading',
  subtitle = 'Fetching the latest details…',
}: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={title}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
