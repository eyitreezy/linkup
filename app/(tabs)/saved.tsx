/**
 * Saved Plans — bookmarked meetups, premium feed polish.
 */
import { Button } from '@/components/Button';
import { SavedPlanCard } from '@/components/plans/SavedPlanCard';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSavedPlansList } from '@/lib/plans/fetchSavedPlans';
import { setPlanSaved } from '@/lib/plans/planEngagement';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

  const countLabel = loading ? null : `${items.length} saved`;

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <View style={styles.root}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF5F8', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.28, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <LinearGradient
              colors={[colors.primary, '#8B7CFF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="bookmark" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Your collection</Text>
              <Text style={styles.heroTitle}>Saved plans</Text>
              <Text style={styles.heroSub}>Bookmarks you can open anytime — jump back in when the moment feels right.</Text>
            </View>
          </View>
          {!loading && items.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countPillTxt}>{countLabel}</Text>
            </View>
          ) : null}
        </View>

        <FlatList
          data={loading ? [] : items}
          keyExtractor={(x) => x.plan.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            loading ? (
              <SavedSkeleton />
            ) : (
              <View style={styles.empty}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.25)', 'rgba(255,101,132,0.2)']}
                  style={styles.emptyRing}
                >
                  <LinearGradient colors={['#fff', '#F8F4FF']} style={styles.emptyRingInner}>
                    <Ionicons name="heart-outline" size={40} color={colors.primary} />
                  </LinearGradient>
                </LinearGradient>
                <Text style={styles.emptyTitle}>
                  Nothing saved <Text style={styles.emptyTitleAccent}>yet</Text>
                </Text>
                <Text style={styles.emptySub}>
                  Tap the bookmark on a plan you like — it lands here so you can pitch or reply when you’re ready.
                </Text>
                <LinearGradient
                  colors={[colors.primary, '#8B7CFF', colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaShell}
                >
                  <Button
                    title="Explore plans"
                    onPress={() => router.push('/' as Href)}
                    pill
                    variant="primary"
                    style={styles.emptyCtaInner}
                    textStyle={styles.emptyCtaTxt}
                  />
                </LinearGradient>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  root: { flex: 1 },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  heroLeft: { flexDirection: 'row', gap: spacing.md, flex: 1, alignItems: 'flex-start' },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  heroText: { flex: 1 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.7 },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 21,
  },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.22)',
    marginTop: 8,
  },
  countPillTxt: { fontSize: 12, fontWeight: '900', color: colors.primary },
  listFlex: { flex: 1 },
  list: { paddingBottom: 120, flexGrow: 1 },
  empty: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, alignItems: 'center' },
  emptyRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  emptyTitle: { fontSize: 23, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  emptyTitleAccent: { color: colors.secondary },
  emptySub: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
    fontWeight: '600',
  },
  emptyCtaShell: {
    marginTop: spacing.xl,
    borderRadius: radius.button,
    padding: 2,
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  emptyCtaInner: { backgroundColor: '#fff', width: '100%', margin: 0 },
  emptyCtaTxt: { color: colors.primary, fontWeight: '900' },
  skelWrap: { paddingTop: spacing.sm },
  skelCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.88)',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.1)',
  },
  skelAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  skelCol: { flex: 1, gap: 8 },
  skelLineLg: { height: 16, borderRadius: 6, backgroundColor: 'rgba(108, 99, 255, 0.12)', width: '90%' },
  skelLineSm: { height: 14, borderRadius: 6, backgroundColor: 'rgba(255, 101, 132, 0.12)', width: '50%' },
  skelLineMd: { height: 12, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.12)', width: '70%' },
});
