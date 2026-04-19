import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

type BlockRow = { blocked_id: string; created_at: string };

export default function PrivacySafetyScreen() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<BlockRow[]>([]);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    const { data } = await supabase.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', user.id);
    setBlocks((data as BlockRow[]) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen scroll>
      <Text style={styles.p}>
        Blocked people won&apos;t appear in your plans feed. Reports and serious issues: use Help &amp; Support.
      </Text>
      <Button title="Help & support" variant="secondary" onPress={() => router.push('/support' as Href)} />
      <Text style={styles.section}>Blocked accounts ({blocks.length})</Text>
      <FlatList
        data={blocks}
        scrollEnabled={false}
        keyExtractor={(item) => item.blocked_id}
        ListEmptyComponent={<Text style={styles.empty}>No blocks yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.mono}>{item.blocked_id.slice(0, 8)}…</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        )}
      />
      <Text style={styles.p}>
        Data usage: LinkUp uses your location for nearby plans, verification media for KYC, and messages for delivery.
        See product privacy copy in docs.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 14, color: colors.textMuted, lineHeight: 22, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  section: { fontSize: 16, fontWeight: '800', paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mono: { fontSize: 14, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.textMuted },
  empty: { paddingHorizontal: spacing.lg, color: colors.textMuted },
});
