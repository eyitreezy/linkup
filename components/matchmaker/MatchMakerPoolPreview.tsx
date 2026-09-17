import { MatchMakerPoolCard } from '@/components/matchmaker/MatchMakerPoolCard';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import type { MatchMakerPoolProfile } from '@/lib/matchmaker/types';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  profiles: MatchMakerPoolProfile[];
};

export function MatchMakerPoolPreview({ profiles }: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const previewRows = profiles.slice(0, 6);

  const signalsByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of previewRows) {
      map.set(row.user_id, buildCompatibilitySignals(row, profile?.communication_style));
    }
    return map;
  }, [previewRows, profile?.communication_style]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} pointerEvents="none">
      <View style={styles.header}>
        <MatchMakerTabIcon size={22} color={MM.accent} active />
        <Text style={styles.headerTitle}>MatchMaker</Text>
        <Ionicons name="settings-outline" size={22} color={MM.muted} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Your pool</Text>
        <Text style={styles.sub}>One connection at a time. Take your time.</Text>
        <View style={styles.list}>
          {previewRows.map((p) => (
            <View key={p.user_id} style={styles.cardSlot}>
              <MatchMakerPoolCard profile={p} signals={signalsByUser.get(p.user_id) ?? []} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  scroll: { paddingHorizontal: spacing.md },
  kicker: { fontSize: 12, fontFamily: fonts.medium, color: MM.muted, textTransform: 'uppercase' },
  sub: { marginTop: 4, fontSize: 14, fontFamily: fonts.regular, color: MM.muted, marginBottom: spacing.md },
  list: { gap: spacing.md },
  cardSlot: { opacity: 0.95 },
});
