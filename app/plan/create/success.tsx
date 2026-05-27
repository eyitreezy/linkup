/**
 * PL3 — published confirmation → Plans feed.
 */
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function CreatePlanSuccessScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { reset } = usePlanDraft();

  useEffect(() => {
    void reset();
  }, [reset]);

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.emoji}>{'\u{1F389}'}</Text>
        <Text style={styles.title}>Your plan is live</Text>
        <Text style={styles.sub}>It’s on the feed. You’ll get offers here and in negotiation.</Text>
      </View>
      <Button title="Browse plans" onPress={() => router.replace('/(tabs)' as Href)} pill style={styles.btn} />
      {planId ? (
        <Button
          title="View your plan"
          variant="secondary"
          onPress={() => router.replace(`/plan/${planId}` as Href)}
          style={styles.btn2}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 1.5,
  },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 24,
    maxWidth: 320,
  },
  btn: { marginHorizontal: spacing.lg },
  btn2: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.button },
});
