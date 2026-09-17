import { MM, MM_CTA_GRADIENT, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REASONS = ['Not compatible', 'Moving too slowly', 'Not feeling it', 'Personal reasons', 'Other'];

export default function MatchMakerEndConnectionScreen() {
  const { id: connectionId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function endConnection() {
    if (!reason || !connectionId || busy) return;
    setBusy(true);
    await supabase.rpc('matchmaker_end_connection', {
      p_connection_id: connectionId,
      p_reason: reason,
    });
    setBusy(false);
    router.replace('/matchmaker/reflect' as Href);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}
    >
      <Text style={styles.title}>End your connection?</Text>
      <Text style={styles.body}>This cannot be undone. No reason will be shared with them.</Text>
      {REASONS.map((r) => (
        <Pressable key={r} onPress={() => setReason(r)} style={[styles.reason, reason === r && styles.reasonOn]}>
          <Text style={[styles.reasonText, reason === r && styles.reasonTextOn]}>{r}</Text>
        </Pressable>
      ))}
      <Pressable disabled={!reason || busy} onPress={() => void endConnection()} style={{ marginTop: spacing.lg }}>
        <LinearGradient colors={[MM.accent, MM.accent]} style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? 'Ending…' : 'End connection'}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md, alignSelf: 'center' }}>
        <Text style={styles.back}>Go back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold, color: MM.text },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, lineHeight: 20, marginBottom: spacing.lg },
  reason: {
    borderWidth: 1,
    borderColor: MM.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: MM.surface,
  },
  reasonOn: { borderColor: MM.accent, backgroundColor: '#FDEDF3' },
  reasonText: { fontFamily: fonts.medium, color: MM.text },
  reasonTextOn: { fontFamily: fonts.bold, color: MM.accent },
  cta: { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold },
  back: { color: MM.muted, fontFamily: fonts.regular },
});
