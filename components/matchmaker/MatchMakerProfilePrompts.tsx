import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import type { ProfilePreferences } from '@/types/database';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  preferences: ProfilePreferences | undefined;
};

export function MatchMakerProfilePrompts({ preferences }: Props) {
  const answers = (preferences?.prompt_answers ?? []).filter((p) => p.answer?.trim().length);
  if (answers.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {answers.map((p) => (
        <View key={p.prompt_id} style={styles.card}>
          <Text style={styles.prompt}>{p.prompt}</Text>
          <Text style={styles.answer}>{p.answer}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    backgroundColor: MM.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  prompt: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: MM.muted,
    marginBottom: 6,
  },
  answer: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: MM.text,
    lineHeight: 22,
  },
});
