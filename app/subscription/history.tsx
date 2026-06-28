/**
 * Member-facing subscription history from subscription_events.
 */
import { Screen } from '@/components/Screen';
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  HIDDEN_SUBSCRIPTION_EVENT_TYPES,
  subscriptionEventIcon,
  subscriptionEventLabel,
} from '@/lib/subscription/subscriptionEventLabels';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { supabase } from '@/lib/supabase';
import type { DbSubscriptionEvent } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type IonName = ComponentProps<typeof Ionicons>['name'];

type EventSection = { title: string; events: DbSubscriptionEvent[] };

type EventAccent = {
  grad: readonly [string, string];
  icon: string;
};

function formatSubscriptionEventDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function formatAmountNgn(amount: number | null | undefined): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return `NGN ${Math.round(amount).toLocaleString()}`;
}

function eventAccent(eventType: string): EventAccent {
  if (eventType === 'payment_failed') {
    return { grad: ['#FEE2E2', '#FECACA'], icon: colors.danger };
  }
  if (eventType === 'payment_succeeded') {
    return { grad: ['#D1FAE5', '#A7F3D0'], icon: colors.success };
  }
  if (eventType.startsWith('trial_') || eventType.startsWith('admin_trial_')) {
    return { grad: ['#FEF3C7', '#FDE68A'], icon: '#D97706' };
  }
  if (eventType === 'subscription_upgraded') {
    return { grad: ['#EDE9FE', '#DDD6FE'], icon: '#7C4DFF' };
  }
  if (eventType === 'subscription_downgraded' || eventType === 'subscription_cancelled') {
    return { grad: ['#F3F4F6', '#E5E7EB'], icon: colors.textMuted };
  }
  return { grad: ['rgba(94, 82, 255,0.16)', 'rgba(255, 74, 114,0.12)'], icon: colors.primary };
}

function tierForEvent(event: DbSubscriptionEvent): SubscriptionTier | null {
  const tier = event.to_tier ?? event.from_tier;
  if (!tier || tier === 'FREE') return null;
  return tier;
}

function groupEventsByMonth(events: DbSubscriptionEvent[]): EventSection[] {
  const groups = new Map<string, DbSubscriptionEvent[]>();
  for (const event of events) {
    const key = new Date(event.created_at).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }
  return [...groups.entries()].map(([title, sectionEvents]) => ({ title, events: sectionEvents }));
}

export default function SubscriptionHistoryScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<DbSubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!user?.id) return;
      if (!opts?.background) setLoading(true);
      const { data, error } = await supabase
        .from('subscription_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) {
        setEvents(
          ((data ?? []) as DbSubscriptionEvent[]).filter(
            (e) => !HIDDEN_SUBSCRIPTION_EVENT_TYPES.has(e.event_type)
          )
        );
      }
      if (!opts?.background) setLoading(false);
    },
    [user?.id]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ background: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => groupEventsByMonth(events), [events]);
  const visibleCount = useMemo(
    () => events.filter((e) => subscriptionEventLabel(e)).length,
    [events]
  );

  return (
    <Screen scroll={false} safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.root}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#D2C9FF', '#FFD1E3', '#B8EDD9', colors.discoveryGradientBottom]}
          locations={[0, 0.28, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.headerSticky}>
          <View style={styles.topNav}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            {visibleCount > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillTxt}>
                  {visibleCount} {visibleCount === 1 ? 'event' : 'events'}
                </Text>
              </View>
            ) : (
              <View style={styles.navSpacer} />
            )}
          </View>

          <View style={styles.heroHeader}>
            <LinearGradient
              colors={[colors.primary, '#8B7CFF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="receipt-outline" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Membership</Text>
              <Text style={styles.heroTitle}>Subscription history</Text>
              <Text style={styles.heroSub}>
                Upgrades, renewals, trials, and payments in one timeline.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            !loading && visibleCount === 0 && styles.scrollContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {loading && events.length === 0 ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loaderTxt}>Loading your history…</Text>
            </View>
          ) : visibleCount === 0 ? (
            <View style={styles.emptyStage}>
              <LinearGradient
                colors={['rgba(94, 82, 255,0.2)', 'rgba(255, 74, 114,0.18)']}
                style={styles.emptyRing}
              >
                <LinearGradient colors={['#fff', '#FFF8FC']} style={styles.emptyRingInner}>
                  <Ionicons name="time-outline" size={38} color={colors.primary} />
                </LinearGradient>
              </LinearGradient>
              <Text style={styles.emptyTitle}>
                No <Text style={styles.emptyTitleAccent}>history</Text> yet
              </Text>
              <Text style={styles.emptySub}>
                When you subscribe, renew, or try a tier, those moments will show up here.
              </Text>
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionHeadRow}>
                    <View style={styles.sectionAccentDot} />
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  </View>
                  <LinearGradient
                    colors={['rgba(94, 82, 255,0.35)', 'rgba(255, 74, 114,0.2)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sectionRule}
                  />
                </View>

                {section.events.map((event) => {
                  const label = subscriptionEventLabel(event);
                  if (!label) return null;
                  const icon = subscriptionEventIcon(event.event_type) as IonName;
                  const accent = eventAccent(event.event_type);
                  const tier = tierForEvent(event);
                  const amount = formatAmountNgn(event.amount_ngn);

                  return (
                    <LinearGradient
                      key={event.id}
                      colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.55)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.eventRing}
                    >
                      <View style={styles.eventCard}>
                        <LinearGradient
                          colors={[...accent.grad]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.eventIconGrad}
                        >
                          <Ionicons name={icon} size={18} color={accent.icon} />
                        </LinearGradient>

                        <View style={styles.eventBody}>
                          <Text style={styles.eventLabel}>{label}</Text>
                          <Text style={styles.eventDate}>
                            {formatSubscriptionEventDateTime(event.created_at)}
                          </Text>
                          {event.billing_cycle ? (
                            <Text style={styles.eventMeta}>
                              {event.billing_cycle === 'annual' ? 'Annual billing' : 'Monthly billing'}
                            </Text>
                          ) : null}
                          {amount ? <Text style={styles.eventAmount}>{amount}</Text> : null}
                        </View>

                        {tier ? <TierBadge tier={tier} compact /> : null}
                      </View>
                    </LinearGradient>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  headerSticky: {
    paddingHorizontal: spacing.md,
    flexShrink: 0,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  backPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  navSpacer: { width: 42 },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.2)',
  },
  countPillTxt: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 21,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  loaderTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  emptyStage: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyRingInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyTitleAccent: { color: colors.primary },
  emptySub: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  section: { marginBottom: spacing.lg },
  sectionHead: { marginBottom: spacing.sm },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionRule: { height: 2, borderRadius: 1 },
  eventRing: {
    borderRadius: radius.lg + 2,
    padding: 1.5,
    marginBottom: spacing.sm,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  eventIconGrad: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { flex: 1, minWidth: 0 },
  eventLabel: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 4,
  },
  eventMeta: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
    marginTop: 4,
  },
  eventAmount: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 6,
  },
});
