/**
 * Notification center — Today / Earlier sections (Hinge clarity + Tinder minimal cards + activity cues).
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
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

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
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>Offers, escrow, and updates in one place</Text>
        </View>
        <Pressable onPress={() => void markAllRead()} hitSlop={12} disabled={!hasUnread}>
          <Text style={[styles.markAll, !hasUnread && styles.markAllDisabled]}>Read all</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['all', 'activity', 'payments', 'system'] as const).map((t) => {
          const on = filter === t;
          return (
            <Pressable
              key={t}
              onPress={() => setFilter(t)}
              style={[styles.tab, on && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{FILTER_LABELS[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      {!isSupabaseConfigured ? (
        <Text style={styles.empty}>Configure Supabase to load notifications.</Text>
      ) : loading && notifications.length === 0 ? (
        <NotificationListSkeleton />
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.empty}>You&apos;re all caught up.</Text>
          <Text style={styles.emptySub}>We&apos;ll nudge you for offers, escrow, and verification — never spam.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          stickySectionHeadersEnabled={false}
          refreshing={loading}
          onRefresh={() => void refresh()}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionRule} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  markAll: { fontSize: 15, fontWeight: '700', color: colors.primary },
  markAllDisabled: { opacity: 0.35 },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  tabTxt: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTxtOn: { color: colors.primary },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  sectionHead: { marginBottom: spacing.sm, marginTop: spacing.md },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  lastInSection: { marginBottom: spacing.md },
  emptyWrap: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl },
  empty: { marginTop: spacing.md, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySub: { marginTop: spacing.sm, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
