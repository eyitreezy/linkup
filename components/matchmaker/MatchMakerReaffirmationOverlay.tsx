import { Button } from '@/components/Button';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { respondMatchMakerReaffirmation } from '@/lib/matchmaker/matchmakerApi';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onComplete: () => void;
};

export function MatchMakerReaffirmationOverlay({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'yes' | 'snooze' | 'leave' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leftPool, setLeftPool] = useState(false);

  async function act(action: 'yes' | 'snooze' | 'leave') {
    setBusy(action);
    setError(null);
    try {
      await respondMatchMakerReaffirmation(action);
      if (action === 'leave') {
        setLeftPool(true);
        return;
      }
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your choice');
    } finally {
      setBusy(null);
    }
  }

  if (leftPool) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        <MatchMakerTabIcon size={48} color={MM.accent} active />
        <Text style={styles.title}>You are off the pool for now</Text>
        <Text style={styles.body}>
          Your MatchMaker preferences are saved. You can turn pool visibility back on anytime in MatchMaker settings.
        </Text>
        <Button
          title="MatchMaker settings"
          onPress={() => router.push('/matchmaker/settings' as Href)}
          gradient
          pill
          fullWidth
          style={{ marginTop: spacing.lg, maxWidth: 320 }}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
      accessibilityRole="alert"
    >
      <MatchMakerTabIcon size={48} color={MM.accent} active />
      <Text style={styles.title}>Still looking?</Text>
      <Text style={styles.body}>
        You have been in the MatchMaker pool for 60 days. We want to make sure you are still actively looking for a
        long-term relationship before keeping your profile visible to others.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={busy === 'yes' ? 'Saving…' : 'Yes, I am still looking'}
        onPress={() => void act('yes')}
        loading={busy === 'yes'}
        disabled={!!busy}
        gradient
        pill
        fullWidth
        style={{ marginTop: spacing.lg, maxWidth: 320 }}
      />

      <Pressable
        onPress={() => void act('snooze')}
        disabled={!!busy}
        hitSlop={8}
        style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={styles.linkAccent}>{busy === 'snooze' ? 'Snoozing…' : 'Ask me later'}</Text>
      </Pressable>

      <Pressable
        onPress={() => void act('leave')}
        disabled={!!busy}
        hitSlop={8}
        style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={styles.linkMuted}>{busy === 'leave' ? 'Updating…' : 'Remove me from the pool'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MM.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: MM.text,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: MM.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },
  error: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#EF4444',
    textAlign: 'center',
  },
  linkBtn: { marginTop: spacing.md, paddingVertical: spacing.sm },
  linkAccent: { fontSize: 14, fontFamily: fonts.bold, color: MM.accent, textDecorationLine: 'underline' },
  linkMuted: { fontSize: 12, fontFamily: fonts.medium, color: MM.muted, textDecorationLine: 'underline' },
});
