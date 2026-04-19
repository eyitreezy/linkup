/**
 * Admin dashboard — verification queue, disputes, support (requires `admins` row for your user).
 */
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

type Ver = { id: string; user_id: string; status: string; created_at: string };
type Disp = { id: string; reason: string; status: string };
type Ticket = { id: string; subject: string; status: string };

export default function AdminScreen() {
  const { isAdmin } = useAuth();
  const [ver, setVer] = useState<Ver[]>([]);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data: v } = await supabase
      .from('verification_requests')
      .select('id, user_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (v) setVer(v as Ver[]);
    const { data: d } = await supabase
      .from('escrow_disputes')
      .select('id, reason, status')
      .order('created_at', { ascending: false })
      .limit(30);
    if (d) setDisp(d as Disp[]);
    const { data: t } = await supabase
      .from('support_tickets')
      .select('id, subject, status')
      .order('created_at', { ascending: false })
      .limit(30);
    if (t) setTickets(t as Ticket[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approveVer(id: string) {
    const { error } = await supabase
      .from('verification_requests')
      .update({ status: 'admin_approved' })
      .eq('id', id);
    if (error) Alert.alert('Approve failed', error.message);
    else Alert.alert('Approved');
    void load();
  }

  async function rejectVer(id: string) {
    const { error } = await supabase.from('verification_requests').update({ status: 'admin_rejected' }).eq('id', id);
    if (error) Alert.alert('Reject failed', error.message);
    else Alert.alert('Rejected');
    void load();
  }

  async function resolveDispute(id: string) {
    await supabase
      .from('escrow_disputes')
      .update({ status: 'resolved', admin_resolution: 'Resolved in app', resolved_at: new Date().toISOString() })
      .eq('id', id);
    void load();
  }

  if (!isAdmin) return <Redirect href="/(tabs)/profile" />;

  return (
    <Screen scroll safeAreaEdges={['top', 'left', 'right']}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.section}>Verification</Text>
      <FlatList
        data={ver}
        scrollEnabled={false}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text>
              {item.status} — user {item.user_id.slice(0, 8)}…
            </Text>
            <View style={styles.row}>
              <Button title="Approve" onPress={() => void approveVer(item.id)} />
              <Button title="Reject" variant="secondary" onPress={() => void rejectVer(item.id)} />
            </View>
          </Card>
        )}
      />
      <Text style={styles.section}>Disputes</Text>
      <FlatList
        data={disp}
        scrollEnabled={false}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text>{item.reason}</Text>
            <Text style={styles.meta}>{item.status}</Text>
            <Button title="Mark resolved" variant="ghost" onPress={() => void resolveDispute(item.id)} />
          </Card>
        )}
      />
      <Text style={styles.section}>Support</Text>
      <FlatList
        data={tickets}
        scrollEnabled={false}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={styles.t}>{item.subject}</Text>
            <Text style={styles.meta}>{item.status}</Text>
          </Card>
        )}
      />
      <Button title="Refresh" variant="ghost" onPress={load} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  section: { fontSize: 18, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.text },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  meta: { color: colors.textMuted, marginTop: 4 },
  t: { fontWeight: '600', color: colors.text },
});
