/**
 * Notification center — gradient shell, inbox hero, and filter chips aligned with create/plan-management polish.
 */
import { NotificationListSkeleton } from '@/components/notifications/NotificationListSkeleton';
import { NotificationSwipeRow } from '@/components/notifications/NotificationSwipeRow';
import { Screen } from '@/components/Screen';
import { useNotificationInbox } from '@/contexts/NotificationInboxContext';
import { colors, radius, spacing } from '@/constants/theme';
import { FILTER_LABELS, type NotificationFilterTab, notificationTab } from '@/lib/notifications/categories';
import { navigateFromNotification } from '@/lib/notifications/navigateFromNotification';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { DbNotification } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

type Section = { title: string; data: DbNotification[] };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sortNotifications(list: DbNotification[]): DbNotification[] {
  const pr: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...list].sort(
    (a, b) =>
      pr[a.priority] - pr[b.priority] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function NotificationsScreen() {
  const { notifications, loading, refresh, markRead, markAllRead, remove } = useNotificationInbox();
  const [filter, setFilter] = useState<NotificationFilterTab>('all');

  const filtered = useMemo(() => {
    const list =
      filter === 'all' ? notifications : notifications.filter((n) => notificationTab(n.type) === filter);
    return sortNotifications(list);
  }, [notifications, filter]);

  const sections = useMemo((): Section[] => {
    const t0 = startOfToday().getTime();
    const today: DbNotification[] = [];
    const earlier: DbNotification[] = [];
    for (const n of filtered) {
      if (new Date(n.created_at).getTime() >= t0) today.push(n);
      else earlier.push(n);
    }
    const out: Section[] = [];
    if (today.length) out.push({ title: 'Today', data: today });
    if (earlier.length) out.push({ title: 'Earlier', data: earlier });
    return out;
  }, [filtered]);

  const onOpen = useCallback(
    async (id: string, data: DbNotification['data'], type: DbNotification['type']) => {
      await markRead(id);
      navigateFromNotification(router, { ...data, type });
    },
    [markRead]
  );

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

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
          <View style={styles.topNavRight}>
            <Pressable
              onPress={() => void markAllRead()}
              hitSlop={8}
              disabled={!hasUnread}
              style={({ pressed }) => [pressed && hasUnread && styles.pressed]}
            >
              <Text style={[styles.markAll, !hasUnread && styles.markAllDisabled]}>Read all</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings/notifications' as Href)}
              style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Notification settings"
            >
              <Ionicons name="settings-outline" size={21} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.leadBlock}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leadAccent}
          />
          <View style={styles.leadTextCol}>
            <Text style={styles.leadKicker}>Inbox</Text>
            <Text style={styles.leadTitle}>Notifications</Text>
            <Text style={styles.leadSub}>Offers, escrow, and updates — sorted by what matters first.</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['all', 'activity', 'payments', 'system'] as const).map((t) => {
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
          <View style={styles.centerPad}>
            <Text style={styles.hint}>Configure Supabase to load notifications.</Text>
          </View>
        ) : loading && notifications.length === 0 ? (
          <NotificationListSkeleton />
        ) : sections.length === 0 ? (
          <View style={styles.emptyCardOuter}>
            <LinearGradient
              colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyCardBorder}
            >
              <View style={styles.emptyCardInner}>
                <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.emptyIconGrad}>
                  <Ionicons name="notifications-outline" size={28} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
                <Text style={styles.emptySub}>
                  We&apos;ll ping you for offers, escrow, and verification — never noise.
                </Text>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(i) => i.id}
            stickySectionHeadersEnabled={false}
            refreshing={loading}
            onRefresh={() => void refresh()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadRow}>
                  <View style={styles.sectionAccentDot} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <LinearGradient
                  colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sectionRule}
                />
              </View>
            )}
            renderItem={({ item, index, section }) => (
              <View style={index === section.data.length - 1 ? styles.lastInSection : undefined}>
                <NotificationSwipeRow
                  item={item}
                  index={index}
                  onPress={() => void onOpen(item.id, item.data, item.type)}
                  onMarkRead={() => void markRead(item.id)}
                  onDelete={() => void remove(item.id)}
                />
              </View>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  markAll: { fontSize: 15, fontWeight: '800', color: colors.primary },
  markAllDisabled: { opacity: 0.35 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
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
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
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
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
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
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  sectionHead: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
  lastInSection: { marginBottom: spacing.md },
  centerPad: { padding: spacing.xl },
  hint: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCardOuter: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  emptyCardBorder: {
    borderRadius: radius.xl,
    padding: 2,
  },
  emptyCardInner: {
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
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
});
