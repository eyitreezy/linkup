/**
 * Friendly empty feed — illustration + CTA (create gated upstream).
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  onCreatePress: () => void;
};

export function PlansEmptyState({ onCreatePress }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.art}>
        <Text style={styles.emoji} accessibilityLabel="Calendar illustration">
          {'\u{1F4C5}'}
        </Text>
      </View>
      <Text style={styles.title}>No plans yet around you</Text>
      <Text style={styles.sub}>Be the first to create something exciting</Text>
      <View style={styles.examples}>
        <Text style={styles.exLabel}>Ideas</Text>
        <Text style={styles.ex}>• Dinner in Lekki tonight</Text>
        <Text style={styles.ex}>• Gym partner this weekend</Text>
        <Text style={styles.ex}>• Coffee & walk near you</Text>
      </View>
      <Button title="Create plan" onPress={onCreatePress} pill style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
  },
  art: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  examples: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginBottom: 8, letterSpacing: 0.5 },
  ex: { fontSize: 14, color: colors.text, lineHeight: 22 },
  cta: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
