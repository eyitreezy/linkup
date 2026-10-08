import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import type { Day10NudgeView } from '@/hooks/useMatchMakerDay10Nudge';
import * as Clipboard from 'expo-clipboard';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  nudge: Day10NudgeView;
  onDismiss: () => void;
};

export function MatchMakerDay10NudgeCard({ nudge, onDismiss }: Props) {
  useEffect(() => {
    if (!nudge.visible) return;
    const t = setTimeout(() => onDismiss(), 8000);
    return () => clearTimeout(t);
  }, [nudge.visible, onDismiss]);

  if (!nudge.visible) return null;

  const planLine =
    nudge.planDaysRemaining != null && nudge.planDaysRemaining > 0
      ? `Your plan window opens in ${nudge.planDaysRemaining} day${nudge.planDaysRemaining === 1 ? '' : 's'}. Take your time. There is no rush.`
      : 'Take your time. There is no rush.';

  return (
    <Pressable style={styles.wrap} onPress={onDismiss}>
      <Text style={styles.title}>You have been connected for 10 days.</Text>
      {nudge.silentPartner ? (
        <>
          <Text style={styles.body}>
            Connections grow through conversation. Here is a prompt to get things going:
          </Text>
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>{nudge.conversationStarter}</Text>
            <Pressable
              onPress={() => void Clipboard.setStringAsync(nudge.conversationStarter)}
              style={styles.copyBtn}
            >
              <Text style={styles.copyText}>Copy to chat</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.body}>How is the conversation going? {planLine}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: MM.surfaceWarm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.bold, color: MM.text, fontSize: 15 },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
  promptCard: {
    marginTop: spacing.sm,
    backgroundColor: MM.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  promptText: { fontFamily: fonts.medium, color: MM.text, lineHeight: 20 },
  copyBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  copyText: { fontFamily: fonts.bold, color: MM.accent, fontSize: 13 },
});
