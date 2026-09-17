import { Avatar } from '@/components/Avatar';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { partnerUserId, daysSince } from '@/lib/matchmaker/connection';
import type { MatchMakerConnection } from '@/lib/matchmaker/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState<{ connection: MatchMakerConnection; name: string; avatar: string | null }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from('matchmaker_connections')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false });
      const list = (data ?? []) as MatchMakerConnection[];
      const enriched = await Promise.all(
        list.map(async (c) => {
          const pid = partnerUserId(c, user.id);
          const { data: prof } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', pid)
            .maybeSingle();
          return {
            connection: c,
            name: prof?.display_name ?? 'Member',
            avatar: prof?.avatar_url ?? null,
          };
        })
      );
      setRows(enriched);
    })();
  }, [user?.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: MM.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={MM.text} />
        </Pressable>
        <Text style={styles.title}>My Connection History</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.sub}>This is private and visible only to you.</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No previous connections yet.</Text>
      ) : (
        rows.map(({ connection, name, avatar }) => (
          <View key={connection.id} style={styles.row}>
            <Avatar uri={avatar} name={name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.meta}>
                {daysSince(connection.connected_at)} days · ended
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  sub: { marginTop: spacing.sm, marginBottom: spacing.lg, fontFamily: fonts.regular, color: MM.muted },
  empty: { fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', marginTop: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: MM.border },
  name: { fontFamily: fonts.bold, color: MM.text },
  meta: { fontFamily: fonts.regular, color: MM.muted, fontSize: 12 },
});
