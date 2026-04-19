/**
 * Inbox empty state — matches PlansEmptyState layout (art + tips + CTA).
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  onBrowsePlansPress: () => void;
};

export function MessagesEmptyState({ onBrowsePlansPress }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.art}>
        <Text style={styles.emoji} accessibilityLabel="Messages illustration">
          {'\u{1F4AC}'}
        </Text>
      </View>
      <Text style={styles.title}>No messages yet</Text>
      <Text style={styles.sub}>Start by joining a plan or replying to an offer — chats stay in one place.</Text>
      <View style={styles.examples}>
        <Text style={styles.exLabel}>How to get chatting</Text>
        <Text style={styles.ex}>• Open a plan you like and send an offer or message</Text>
        <Text style={styles.ex}>• Hosts and guests can open a thread after you connect</Text>
        <Text style={styles.ex}>• Keep early coordination on LinkUp for safety</Text>
      </View>
      <Button title="Browse plans" onPress={onBrowsePlansPress} pill style={styles.cta} />
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
