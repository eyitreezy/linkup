/**
 * Premium — who viewed or saved this plan (creator only). Inbox-grade shell.
 */
import { PlanInterestEngagementCard } from '@/components/plans/PlanInterestEngagementCard';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { fetchIncognitoUserIds } from '@/lib/plans/incognitoEngagement';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Row = {
  user_id: string;
  kind: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
};

const GRADIENT_COLORS = ['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom] as const;
const HEADER_BAR = { backgroundColor: 'transparent', borderBottomWidth: 0 } as const;

function InterestShell({ children }: { children: ReactNode }) {
  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot} style={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={[...GRADIENT_COLORS]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {children}
      </View>
    </Screen>
  );
}

function InterestLeadBlock({
  planTitle,
  viewCount,
  saveCount,
  statsLoading,
}: {
  planTitle: string;
  viewCount: number;
  saveCount: number;
  statsLoading?: boolean;
}) {
  return (
    <View style={styles.leadBlock}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.leadAccent}
      />
      <View style={styles.leadTextCol}>
        <Text style={styles.leadKicker}>Premium insight</Text>
        <Text style={styles.leadTitle}>Who&apos;s interested</Text>
        <Text style={styles.leadSub}>
          {planTitle.trim()
            ? `Views and saves on “${planTitle.trim()}”. Tap someone to open their profile.`
            : 'Views and saves on this plan. Tap someone to open their profile.'}
        </Text>
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <LinearGradient
              colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={styles.statTxt}>
              {statsLoading ? '…' : `${viewCount} viewed`}
            </Text>
          </View>
          <View style={[styles.statPill, styles.statPillSave]}>
            <LinearGradient
              colors={['rgba(255,101,132,0.14)', 'rgba(108,99,255,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="bookmark-outline" size={16} color={colors.secondary} />
            <Text style={styles.statTxt}>
              {statsLoading ? '…' : `${saveCount} saved`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function InterestListSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLine} />
          </View>
        </View>
      ))}
      <ActivityIndicator color={colors.primary} style={styles.skeletonSpinner} />
    </View>
  );
}

function InterestEmptyState() {
  return (
    <View style={styles.emptyOuter}>
      <LinearGradient
        colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyBorder}
      >
        <View style={styles.emptyInner}>
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.emptyIconGrad}>
            <Ionicons name="heart-outline" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>No interest yet</Text>
          <Text style={styles.emptySub}>
            When people view or save this plan, they&apos;ll show up here, a quiet signal someone&apos;s curious.
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

function PremiumGateCard() {
  return (
    <ScrollView
      contentContainerStyle={styles.gateScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(108,99,255,0.22)', 'rgba(255,101,132,0.14)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gateBorder}
      >
        <View style={styles.gateInner}>
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.gateIconGrad}>
            <Ionicons name="diamond-outline" size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.gateTitle}>See who&apos;s into your plans</Text>
          <Text style={styles.gateSub}>
            Premium shows everyone who viewed or saved this meetup so you know who to welcome first.
          </Text>
          <Pressable
            onPress={() => router.push('/subscription' as Href)}
            style={({ pressed }) => [styles.gateCtaOuter, pressed && styles.gateCtaPressed]}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Premium"
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gateCtaGrad}
            >
              <Text style={styles.gateCtaTxt}>Go Premium</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

export default function PlanInterestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, dbUser } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [engagementsLoading, setEngagementsLoading] = useState(true);
  const hasCachedRowsRef = useRef(false);
  const { allowed: canSeeInterest } = usePermission('plans.see_all_likes');

  const load = useCallback(
    async (options?: { background?: boolean }) => {
      if (!id || !isSupabaseConfigured) {
        setEngagementsLoading(false);
        return;
      }
      const showListLoading = !options?.background && !hasCachedRowsRef.current;
      if (showListLoading) setEngagementsLoading(true);

      try {
        const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
        setPlan(p as DbPlan | null);
        if (!p || (p as DbPlan).creator_id !== user?.id || !canSeeInterest) {
          setRows([]);
          hasCachedRowsRef.current = false;
          return;
        }
        const { data: eng } = await supabase
          .from('plan_engagements')
          .select('user_id, kind, created_at')
          .eq('plan_id', id)
          .order('created_at', { ascending: false });
        const list = eng ?? [];
        const userIds = [...new Set(list.map((e) => e.user_id as string))];
        const incognitoIds = await fetchIncognitoUserIds(userIds);
        const visibleEngagements = list.filter((e) => !incognitoIds.has(e.user_id as string));
        let profs: { user_id: string; display_name: string | null; avatar_url: string | null }[] = [];
        const visibleIds = [...new Set(visibleEngagements.map((e) => e.user_id as string))];
        if (visibleIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', visibleIds);
          profs = (data ?? []) as typeof profs;
        }
        const pmap = new Map(profs.map((pr) => [pr.user_id, pr]));
        const nextRows = visibleEngagements.map((e) => {
          const pr = pmap.get(e.user_id as string);
          return {
            user_id: e.user_id as string,
            kind: e.kind as string,
            created_at: e.created_at as string,
            display_name: pr?.display_name ?? null,
            avatar_url: pr?.avatar_url ?? null,
          };
        });
        setRows(nextRows);
        hasCachedRowsRef.current = nextRows.length > 0;
      } finally {
        setEngagementsLoading(false);
      }
    },
    [id, user?.id, canSeeInterest]
  );

  useFocusEffect(
    useCallback(() => {
      void load({ background: hasCachedRowsRef.current });
    }, [load])
  );

  const { viewCount, saveCount } = useMemo(() => {
    let views = 0;
    let saves = 0;
    for (const r of rows) {
      if (r.kind === 'save') saves += 1;
      else views += 1;
    }
    return { viewCount: views, saveCount: saves };
  }, [rows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ background: true });
    setRefreshing(false);
  }, [load]);

  if (!plan && id) {
    return (
      <InterestShell>
        <PlanStackScreenHeader title="Interest" barStyle={HEADER_BAR} titleStyle={styles.headerTitle} />
        <PlanScreenLoading title="Loading activity" subtitle="Fetching views and saves for this plan." />
      </InterestShell>
    );
  }

  if (plan && user && plan.creator_id !== user.id) {
    return (
      <InterestShell>
        <PlanStackScreenHeader title="Interest" barStyle={HEADER_BAR} titleStyle={styles.headerTitle} />
        <View style={styles.centerState}>
          <LinearGradient
            colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.centerBorder}
          >
            <View style={styles.centerInner}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
              <Text style={styles.centerTitle}>Host only</Text>
              <Text style={styles.centerSub}>Only the host can see who viewed or saved this plan.</Text>
            </View>
          </LinearGradient>
        </View>
      </InterestShell>
    );
  }

  if (!canSeeInterest) {
    return (
      <InterestShell>
        <PlanStackScreenHeader title="Interest" barStyle={HEADER_BAR} titleStyle={styles.headerTitle} />
        <PremiumGateCard />
      </InterestShell>
    );
  }

  return (
    <InterestShell>
      <PlanStackScreenHeader title="Interest" barStyle={HEADER_BAR} titleStyle={styles.headerTitle} />
      <FlatList
        style={styles.listFlex}
        data={rows}
        keyExtractor={(item, i) => `${item.user_id}-${item.kind}-${i}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          plan ? (
            <InterestLeadBlock
              planTitle={plan.title ?? ''}
              viewCount={viewCount}
              saveCount={saveCount}
              statsLoading={engagementsLoading}
            />
          ) : null
        }
        ListEmptyComponent={
          engagementsLoading ? <InterestListSkeleton /> : rows.length === 0 ? <InterestEmptyState /> : null
        }
        renderItem={({ item }) => (
          <PlanInterestEngagementCard
            name={item.display_name?.trim() || 'Member'}
            avatarUrl={item.avatar_url}
            kind={item.kind}
            createdAt={item.created_at}
            onPress={() => router.push(`/user/${item.user_id}` as Href)}
          />
        )}
      />
    </InterestShell>
  );
}

const styles = StyleSheet.create({
  screenRoot: { backgroundColor: 'transparent', flex: 1 },
  flex: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  listFlex: { flex: 1 },
  listContent: { paddingBottom: spacing.xl * 2, flexGrow: 1 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    alignSelf: 'stretch',
    minHeight: 52,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statPill: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  statPillSave: { borderColor: 'rgba(255, 101, 132, 0.25)' },
  statTxt: { fontSize: 13, fontWeight: '800', color: colors.text },
  emptyOuter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyBorder: { borderRadius: radius.xl + 2, padding: 2 },
  emptyInner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  emptyIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  gateScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    flexGrow: 1,
    justifyContent: 'center',
  },
  gateBorder: { borderRadius: radius.xl + 2, padding: 2 },
  gateInner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  gateIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.35,
    marginBottom: spacing.sm,
  },
  gateSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  gateCtaOuter: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  gateCtaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  gateCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  gateCtaTxt: { fontSize: 17, fontWeight: '800', color: '#fff' },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centerBorder: { borderRadius: radius.xl + 2, padding: 2 },
  centerInner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.96)',
    gap: spacing.sm,
  },
  centerTitle: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' },
  centerSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  skeletonWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  skeletonBody: { flex: 1, gap: 8 },
  skeletonLineWide: {
    height: 14,
    width: '55%',
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  skeletonLine: {
    height: 12,
    width: '40%',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.1)',
  },
  skeletonSpinner: { marginTop: spacing.md, alignSelf: 'center' },
});
