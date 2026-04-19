/**
 * Premium — who viewed or saved this plan (creator only).
 */
import { Screen } from '@/components/Screen';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Row = {
  user_id: string;
  kind: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function PlanInterestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, dbUser } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const premium = isPremiumSubscriber(dbUser);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) return;
    const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
    setPlan(p as DbPlan | null);
    if (!p || (p as DbPlan).creator_id !== user?.id || !premium) {
      setRows([]);
      return;
    }
    const { data: eng } = await supabase
      .from('plan_engagements')
      .select('user_id, kind, created_at')
      .eq('plan_id', id)
      .order('created_at', { ascending: false });
    const list = eng ?? [];
    const userIds = [...new Set(list.map((e) => e.user_id as string))];
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);
    const pmap = new Map((profs ?? []).map((pr) => [pr.user_id as string, pr]));
    setRows(
      list.map((e) => {
        const pr = pmap.get(e.user_id as string);
        return {
          user_id: e.user_id as string,
          kind: e.kind as string,
          created_at: e.created_at as string,
          display_name: pr?.display_name ?? null,
          avatar_url: pr?.avatar_url ?? null,
        };
      })
    );
  }, [id, user?.id, premium]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!plan && id) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Interest" />
        <PlanScreenLoading
          title="Loading activity"
          subtitle="Fetching views and saves for this plan."
        />
      </Screen>
    );
  }

  if (plan && user && plan.creator_id !== user.id) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Interest" />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>Host only</Text>
          <Text style={styles.centerSub}>Only the host can see who viewed or saved this plan.</Text>
        </View>
      </Screen>
    );
  }

  if (!premium) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Interest" />
        <ScrollView
          contentContainerStyle={styles.premiumGateScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.gateLead}>See who viewed or saved your plans with Premium.</Text>
          <Pressable style={styles.link} onPress={() => router.push('/premium' as Href)}>
            <Text style={styles.linkTxt}>Upgrade to Premium</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <PlanStackScreenHeader title="Interest" />
      <FlatList
        style={styles.listFlex}
        data={rows}
        keyExtractor={(item, i) => `${item.user_id}-${item.kind}-${i}`}
        ListEmptyComponent={<Text style={styles.emptyList}>No views or saves yet.</Text>}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/user/${item.user_id}` as Href)}
            accessibilityRole="button"
          >
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.av} contentFit="cover" />
            ) : (
              <View style={[styles.av, styles.ph]}>
                <Text style={styles.phTxt}>{(item.display_name ?? '?').slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.meta}>
              <Text style={styles.name}>{item.display_name?.trim() || 'Member'}</Text>
              <Text style={styles.sub}>
                {item.kind === 'save' ? 'Saved' : 'Viewed'} ·{' '}
                {new Date(item.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listFlex: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  centerSub: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  premiumGateScroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  gateLead: { fontSize: 16, color: colors.text, lineHeight: 24, marginBottom: spacing.lg },
  link: { alignSelf: 'flex-start' },
  linkTxt: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  emptyList: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  ph: { alignItems: 'center', justifyContent: 'center' },
  phTxt: { fontWeight: '800', color: colors.textMuted },
  meta: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
