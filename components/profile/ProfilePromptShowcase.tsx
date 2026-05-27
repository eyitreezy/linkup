/**
 * Hinge-style prompt cards on the profile hub (read-only preview).
 */
import { colors, radius, spacing } from '@/constants/theme';
import type { ProfilePreferences } from '@/types/database';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  preferences: ProfilePreferences | undefined;
};

export function ProfilePromptShowcase({ preferences }: Props) {
  const answers = (preferences?.prompt_answers ?? []).filter((p) => p.answer?.trim().length);
  if (answers.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadRow}>
          <View style={styles.sectionAccentDot} />
          <Text style={styles.sectionTitle}>A little about you</Text>
        </View>
        <LinearGradient
          colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionRule}
        />
      </View>
      {answers.map((p) => (
        <LinearGradient
          key={p.prompt_id}
          colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardOuter}
        >
          <View style={styles.cardInner}>
            <Text style={styles.prompt}>{p.prompt}</Text>
            <Text style={styles.answer}>{p.answer}</Text>
          </View>
        </LinearGradient>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.md, marginBottom: spacing.lg },
  sectionHead: {
    marginBottom: spacing.sm,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  cardOuter: {
    borderRadius: radius.lg,
    padding: 2,
    marginBottom: spacing.sm,
  },
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg - 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  prompt: { fontSize: 13, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  answer: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 },
});
