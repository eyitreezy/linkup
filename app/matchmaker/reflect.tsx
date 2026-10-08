import { Input } from '@/components/Input';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import {
  fetchMatchMakerGateState,
  gateRouteFor,
  saveReflectionPeriod,
} from '@/lib/matchmaker/gates';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerReflectScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [reflectionDay, setReflectionDay] = useState(1);
  const [daysUntilPool, setDaysUntilPool] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncGate = useCallback(async () => {
    setLoading(true);
    try {
      const state = await fetchMatchMakerGateState();
      if (state.gate !== 'reflection') {
        const redirect = gateRouteFor(state);
        if (redirect) router.replace(redirect as Href);
        else router.replace('/matchmaker' as Href);
        return;
      }
      setReflectionDay(state.reflectionDay ?? 1);
      setDaysUntilPool(state.daysUntilPool ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void syncGate();
    }, [syncGate])
  );

  async function savePrivate(skip: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await saveReflectionPeriod(text, skip);
    } catch {
      // Non-blocking; reflection period continues server-side
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  const progressPct = Math.min(100, (reflectionDay / 3) * 100);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.surfaceWarm }}
      contentContainerStyle={{
        paddingTop: insets.top + 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <View style={styles.iconWrap}>
        <MatchMakerTabIcon size={40} color={MM.accent} active={false} />
      </View>
      <Text style={styles.title}>Take a moment.</Text>
      <Text style={styles.body}>
        Reflect on what you experienced. We will be here when you are ready.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>What did you learn from this connection?</Text>
        <Input
          value={text}
          onChangeText={setText}
          multiline
          variant="onboarding"
          placeholder="Private reflection"
          emojiAccessory={false}
          style={styles.input}
        />
        <Pressable
          disabled={busy}
          onPress={() => void savePrivate(false)}
          style={styles.saveMuted}
        >
          <Text style={styles.saveMutedText}>Save privately</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void savePrivate(true)} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <Text style={styles.progress}>Reflection period · Day {reflectionDay} of 3</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={styles.note}>
        {daysUntilPool != null
          ? `Your MatchMaker discovery pool resumes in ${daysUntilPool} day${daysUntilPool === 1 ? '' : 's'}. All other LinkUp features are available as normal.`
          : 'All other LinkUp features are available as normal.'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: MM.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { alignSelf: 'center', opacity: 0.5 },
  title: { marginTop: spacing.lg, fontSize: 22, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  body: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: MM.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    marginTop: spacing.xl,
    backgroundColor: MM.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  cardLabel: { fontFamily: fonts.medium, color: MM.text, marginBottom: spacing.sm },
  input: { minHeight: 100, textAlignVertical: 'top' },
  saveMuted: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  saveMutedText: { color: MM.muted, fontFamily: fonts.medium, fontSize: 13 },
  skip: { marginTop: spacing.sm, alignSelf: 'flex-end' },
  skipText: { color: MM.muted, fontFamily: fonts.regular },
  progress: { marginTop: spacing.lg, textAlign: 'center', color: MM.muted, fontFamily: fonts.regular },
  progressTrack: {
    marginTop: spacing.sm,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: MM.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: MM.accent, opacity: 0.45 },
  note: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: MM.muted,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
});
