import { Button } from '@/components/Button';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
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
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
      }}
    >
      <Text style={styles.title}>End your connection?</Text>
      <Text style={styles.body}>This cannot be undone. No reason will be shared with them.</Text>
      <ChoiceChipRow>
        {REASONS.map((r) => (
          <ChoiceChip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </ChoiceChipRow>
      <Button
        title="End connection"
        onPress={() => void endConnection()}
        loading={busy}
        disabled={!reason}
        gradient
        pill
        fullWidth
        style={{ marginTop: spacing.lg }}
      />
      <Button
        title="Go back"
        onPress={() => router.back()}
        variant="ghost"
        fullWidth
        style={{ marginTop: spacing.md }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold, color: MM.text },
  body: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: MM.muted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
});
