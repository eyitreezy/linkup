import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM, MM_CTA_GRADIENT, fonts, spacing } from '@/constants/matchmakerTheme';
import { enterMatchMakerPoolAfterReentry, fetchMatchMakerGateState, gateRouteFor } from '@/lib/matchmaker/gates';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerReentryScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncGate = useCallback(async () => {
    setLoading(true);
    try {
      const state = await fetchMatchMakerGateState();
      if (state.gate !== 'reentry') {
        const redirect = gateRouteFor(state);
        if (redirect) router.replace(redirect as Href);
        else router.replace('/matchmaker' as Href);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void syncGate();
    }, [syncGate])
  );

  async function enterPool() {
    if (busy) return;
    setBusy(true);
    try {
      await enterMatchMakerPoolAfterReentry();
      router.replace('/matchmaker' as Href);
    } catch (e) {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <MatchMakerTabIcon size={48} color={MM.accent} active />
      <Text style={styles.title}>Ready when you are.</Text>
      <Text style={styles.body}>
        We have updated your MatchMaker profile based on what you shared. Your pool is waiting.
      </Text>
      <Pressable
        disabled={busy}
        onPress={() => void enterPool()}
        style={{ marginTop: spacing.xl, width: '100%', paddingHorizontal: spacing.lg }}
      >
        <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Enter MatchMaker</Text>
          )}
        </LinearGradient>
      </Pressable>
      <Text style={styles.note}>There is no rush. This will be here whenever you feel ready.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg, alignItems: 'center', paddingHorizontal: spacing.lg },
  title: { marginTop: spacing.lg, fontSize: 24, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', lineHeight: 22 },
  cta: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  note: { marginTop: spacing.md, fontSize: 12, fontFamily: fonts.regular, color: MM.muted, textAlign: 'center' },
});
