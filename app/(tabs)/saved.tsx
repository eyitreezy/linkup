/**
 * Saved Plans — bookmarked plans (Premium save).
 */
import { Button } from '@/components/Button';
import { SavedPlanCard } from '@/components/plans/SavedPlanCard';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSavedPlansList } from '@/lib/plans/fetchSavedPlans';
import { setPlanSaved } from '@/lib/plans/planEngagement';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function SavedSkeleton() {
  return (
    <View style={styles.skelWrap}>
      {[0, 1, 2].map((k) => (
        <View key={k} style={styles.skelCard}>
          <View style={styles.skelAvatar} />
          <View style={styles.skelCol}>
            <View style={styles.skelLineLg} />
            <View style={styles.skelLineSm} />
            <View style={styles.skelLineMd} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SavedPlansScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchSavedPlansList>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSavedPlansList(user.id);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
      if (!user?.id || !isSupabaseConfigured) return () => {};
      const ch = supabase
        .channel(`saved-plans-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'plan_engagements',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const kind =
              (payload.new as { kind?: string } | null)?.kind ??
              (payload.old as { kind?: string } | null)?.kind;
            if (kind === 'save') void loadRef.current();
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(ch);
      };
    }, [user?.id])
  );

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      const data = await fetchSavedPlansList(user.id);
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  function confirmUnsave(planId: string, title: string) {
    if (!user?.id) return;
    Alert.alert('Remove saved plan?', `“${title}” will disappear from this list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void runUnsave(planId),
      },
    ]);
  }

  async function runUnsave(planId: string) {
    if (!user?.id) return;
    const { error } = await setPlanSaved(supabase, planId, user.id, false);
    if (error) Alert.alert('Could not update', error);
    else setItems((prev) => prev.filter((x) => x.plan.id !== planId));
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved plans</Text>
        <Text style={styles.sub}>Your bookmarked meetups, ready when you are</Text>
      </View>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(x) => x.plan.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <SavedSkeleton />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No saved plans yet</Text>
              <Text style={styles.emptySub}>Save plans you like to view them later</Text>
              <Button title="Explore plans" onPress={() => router.push('/' as Href)} style={styles.emptyCta} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <SavedPlanCard
            item={item}
            onPressCard={() => router.push(`/plan/${item.plan.id}` as Href)}
            onUnsave={() => confirmUnsave(item.plan.id, item.plan.title)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20, fontWeight: '500' },
  list: { paddingBottom: 120, flexGrow: 1 },
  empty: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptySub: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  emptyCta: { marginTop: spacing.lg, minWidth: 200 },
  skelWrap: { paddingTop: spacing.sm },
  skelCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  skelAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.border },
  skelCol: { flex: 1, gap: 8 },
  skelLineLg: { height: 16, borderRadius: 6, backgroundColor: colors.border, width: '90%' },
  skelLineSm: { height: 14, borderRadius: 6, backgroundColor: colors.border, width: '50%' },
  skelLineMd: { height: 12, borderRadius: 6, backgroundColor: colors.border, width: '70%' },
});
