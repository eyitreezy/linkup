/**
 * Disputes — escrow-linked rows and plan-based safety disputes.
 */
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbDispute, PlanDisputeStatus } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type EscrowDisp = { id: string; reason: string; status: string; escrow_id: string };

type DisputeFilterTab = 'all' | 'plans' | 'escrow';

const FILTER_LABELS: Record<DisputeFilterTab, string> = {
  all: 'All',
  plans: 'Plan issues',
  escrow: 'Escrow',
};

function titleCaseStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function planStatusStyle(status: PlanDisputeStatus): { bg: string; fg: string } {
  switch (status) {
    case 'pending':
    case 'reviewing':
      return { bg: 'rgba(108, 99, 255, 0.14)', fg: colors.primary };
    case 'resolved':
      return { bg: 'rgba(52, 211, 153, 0.16)', fg: '#047857' };
    case 'rejected':
      return { bg: 'rgba(239, 68, 68, 0.12)', fg: colors.danger };
    default:
      return { bg: 'rgba(107, 114, 128, 0.12)', fg: colors.textMuted };
  }
}

function escrowStatusStyle(status: string): { bg: string; fg: string } {
  const open = status === 'open' || status === 'under_review';
  if (open) return { bg: 'rgba(108, 99, 255, 0.14)', fg: colors.primary };
  if (status === 'resolved') return { bg: 'rgba(52, 211, 153, 0.16)', fg: '#047857' };
  return { bg: 'rgba(107, 114, 128, 0.12)', fg: colors.textMuted };
}

export default function DisputesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [escrowRows, setEscrowRows] = useState<EscrowDisp[]>([]);
  const [planRows, setPlanRows] = useState<DbDispute[]>([]);
  const [filter, setFilter] = useState<DisputeFilterTab>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setEscrowRows([]);
      setPlanRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: esc } = await supabase
      .from('escrow_transactions')
      .select('id')
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`);
    const ids = esc?.map((e) => e.id) ?? [];
    if (!ids.length) {
      setEscrowRows([]);
    } else {
      const { data } = await supabase
        .from('escrow_disputes')
        .select('id, reason, status, escrow_id')
        .in('escrow_id', ids);
      if (data) setEscrowRows(data as EscrowDisp[]);
      else setEscrowRows([]);
    }

    const { data: pd } = await supabase
      .from('disputes')
      .select('*')
      .or(`reporter_id.eq.${user.id},reported_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(40);
    if (pd) setPlanRows(pd as DbDispute[]);
    else setPlanRows([]);

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const showPlans = filter === 'all' || filter === 'plans';
  const showEscrow = filter === 'all' || filter === 'escrow';

  const bothEmpty = planRows.length === 0 && escrowRows.length === 0;

  const filterEmptyMessage = useMemo(() => {
    if (filter === 'plans') return 'No plan disputes yet.';
    if (filter === 'escrow') return 'No escrow disputes linked to your account.';
    return '';
  }, [filter]);

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xl },
          ]}
        >
          <View style={styles.topNav}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Resolution center</Text>
              <Text style={styles.leadTitle}>Disputes</Text>
              <Text style={styles.leadSub}>
                Plan safety issues and escrow holds you&apos;re part of — in one place, same polish as your inbox.
              </Text>
            </View>
          </View>

          <View style={styles.tabs}>
            {(['all', 'plans', 'escrow'] as const).map((t) => {
              const on = filter === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setFilter(t)}
                  style={styles.tabOuter}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  {on ? (
                    <LinearGradient
                      colors={[colors.primary, '#8B7CE8', colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tabGrad}
                    >
                      <Text style={styles.tabTxtOn}>{FILTER_LABELS[t]}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tabIdle}>
                      <Text style={styles.tabTxt}>{FILTER_LABELS[t]}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {!isSupabaseConfigured ? (
            <Text style={styles.hint}>Configure Supabase to load disputes.</Text>
          ) : loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : bothEmpty ? (
            filter === 'all' ? (
              <LinearGradient
                colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyOuter}
              >
                <View style={styles.emptyInner}>
                  <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.emptyIconGrad}>
                    <Ionicons name="git-merge-outline" size={28} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>You&apos;re clear</Text>
                  <Text style={styles.emptySub}>
                    No plan or escrow disputes right now. If something comes up, you&apos;ll see it here — and you can
                    always reach us from Support &amp; help.
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyOuter}
              >
                <View style={styles.emptyInnerCompact}>
                  <Text style={styles.filterEmptyTxt}>{filterEmptyMessage}</Text>
                </View>
              </LinearGradient>
            )
          ) : (
            <>
              {showPlans ? (
                <>
                  <View style={styles.sectionHead}>
                    <View style={styles.sectionHeadRow}>
                      <View style={styles.sectionAccentDot} />
                      <Text style={styles.sectionTitle}>Plan issues</Text>
                    </View>
                    <LinearGradient
                      colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionRule}
                    />
                  </View>
                  {planRows.length === 0 ? (
                    <Text style={styles.sectionEmpty}>No plan disputes yet.</Text>
                  ) : (
                    <View style={styles.listGap}>
                      {planRows.map((item) => {
                        const st = planStatusStyle(item.status);
                        return (
                          <LinearGradient
                            key={item.id}
                            colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.rowOuter}
                          >
                            <Pressable
                              onPress={() => router.push(`/dispute/${item.plan_id}` as Href)}
                              style={({ pressed }) => [styles.rowInner, pressed && styles.rowPressed]}
                              accessibilityRole="button"
                              accessibilityLabel={`Plan dispute ${item.category}`}
                            >
                              <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.rowIconGrad}>
                                <Ionicons name="flag-outline" size={20} color="#fff" />
                              </LinearGradient>
                              <View style={styles.rowText}>
                                <Text style={styles.rowTitle} numberOfLines={2}>
                                  {titleCaseStatus(item.category)}
                                </Text>
                                <View style={styles.rowMetaRow}>
                                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                                    <Text style={[styles.pillTxt, { color: st.fg }]}>{titleCaseStatus(item.status)}</Text>
                                  </View>
                                  <Text style={styles.rowDate}>
                                    Updated {new Date(item.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                  </Text>
                                </View>
                              </View>
                              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                            </Pressable>
                          </LinearGradient>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              {showEscrow ? (
                <>
                  <View style={[styles.sectionHead, showPlans && planRows.length > 0 && styles.sectionHeadSpaced]}>
                    <View style={styles.sectionHeadRow}>
                      <View style={styles.sectionAccentDot} />
                      <Text style={styles.sectionTitle}>Escrow</Text>
                    </View>
                    <LinearGradient
                      colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionRule}
                    />
                  </View>
                  {escrowRows.length === 0 ? (
                    <Text style={styles.sectionEmpty}>No active escrow disputes.</Text>
                  ) : (
                    <View style={styles.listGap}>
                      {escrowRows.map((item) => {
                        const st = escrowStatusStyle(item.status);
                        return (
                          <LinearGradient
                            key={item.id}
                            colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.rowOuter}
                          >
                            <Pressable
                              onPress={() => router.push(`/escrow/${item.escrow_id}` as Href)}
                              style={({ pressed }) => [styles.rowInner, pressed && styles.rowPressed]}
                              accessibilityRole="button"
                              accessibilityLabel="Open escrow dispute"
                            >
                              <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.rowIconGrad}>
                                <Ionicons name="wallet-outline" size={20} color="#fff" />
                              </LinearGradient>
                              <View style={styles.rowText}>
                                <Text style={styles.rowTitle} numberOfLines={2}>
                                  {item.reason}
                                </Text>
                                <View style={styles.rowMetaRow}>
                                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                                    <Text style={[styles.pillTxt, { color: st.fg }]}>{titleCaseStatus(item.status)}</Text>
                                  </View>
                                </View>
                              </View>
                              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                            </Pressable>
                          </LinearGradient>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}
            </>
          )}

          <Pressable style={styles.supportLink} onPress={() => router.push('/support' as Href)}>
            <LinearGradient
              colors={['rgba(108,99,255,0.1)', 'rgba(255,101,132,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.supportLinkGrad}
            >
              <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.supportLinkTxt}>Support &amp; help</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
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
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.lg,
  },
  tabOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  tabGrad: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  tabIdle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  tabTxt: { fontSize: 13, fontWeight: '800', color: colors.text },
  tabTxtOn: { fontSize: 13, fontWeight: '900', color: '#fff' },
  hint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontWeight: '600',
    marginVertical: spacing.lg,
  },
  sectionHead: {
    marginBottom: spacing.sm,
  },
  sectionHeadSpaced: {
    marginTop: spacing.lg,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  sectionEmpty: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  listGap: { gap: spacing.sm, marginBottom: spacing.md },
  rowOuter: {
    borderRadius: radius.lg,
    padding: 2,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg - 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  rowPressed: {
    opacity: 0.96,
  },
  rowIconGrad: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  pillTxt: { fontSize: 12, fontWeight: '800' },
  rowDate: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  emptyOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
  },
  emptyInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  emptyInnerCompact: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  filterEmptyTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
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
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
  },
  supportLink: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  supportLinkGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  supportLinkTxt: { fontSize: 16, fontWeight: '800', color: colors.primary },
});
