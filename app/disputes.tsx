/**
 * Disputes list — escrow-linked disputes visible to parties; admin resolves in dashboard.
 */
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

type Row = { id: string; reason: string; status: string; escrow_id: string };

export default function DisputesScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    const { data: esc } = await supabase
      .from('escrow_transactions')
      .select('id')
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`);
    const ids = esc?.map((e) => e.id) ?? [];
    if (!ids.length) {
      setRows([]);
      return;
    }
    const { data } = await supabase
      .from('escrow_disputes')
      .select('id, reason, status, escrow_id')
      .in('escrow_id', ids);
    if (data) setRows(data as Row[]);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen scroll safeAreaEdges={['top', 'left', 'right']}>
      <Text style={styles.title}>Disputes</Text>
      <FlatList
        data={rows}
        scrollEnabled={false}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.empty}>No active disputes.</Text>}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={styles.t}>{item.reason}</Text>
            <Text style={styles.meta}>{item.status}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  t: { fontWeight: '600', color: colors.text },
  meta: { color: colors.textMuted, marginTop: 4 },
  empty: { color: colors.textMuted },
});
