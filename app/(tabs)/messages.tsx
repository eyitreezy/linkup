/**
 * M1 — Inbox: dating-app shell, active engagements strip, card rows, realtime refresh.
 */
import { PlanEngagementStrip } from '@/components/discovery/PlanEngagementStrip';
import { ConversationCard } from '@/components/messages/ConversationCard';
import { MessagesEmptyState } from '@/components/messages/MessagesEmptyState';
import { MessagesInboxSkeleton } from '@/components/messages/MessagesInboxSkeleton';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatRelativeShort } from '@/lib/messaging/formatRelative';
import { getLastReadMap } from '@/lib/messaging/inboxCache';
import { messageDisplayText, parseLegacyImageBody } from '@/lib/messaging/chatQueries';
import { fetchFeedEngagementCarousel, type EngagementCarouselItem } from '@/lib/plans/fetchFeedEngagementCarousel';
import { fetchPresenceMap } from '@/lib/presence/presenceHeartbeat';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbUserPresence } from '@/types/database';
import { Href, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTabBarScrollProps } from '@/hooks/useTabBarScrollHandler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

type InboxRow = {
  id: string;
  otherId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  preview: string;
  timeIso: string;
  unread: boolean;
  isGroupChat?: boolean;
  groupAvatarUrl?: string | null;
  memberCount?: number;
  memberPreviews?: { avatarUrl: string | null; name: string }[];
};

function previewForLast(
  body: string | null,
  mediaKind: 'image' | 'video' | null,
  deletedAt?: string | null
): string {
  if (deletedAt) return 'Message deleted';
  const legacy = parseLegacyImageBody(body);
  if (legacy) return 'Sent a photo';
  if (mediaKind === 'video' && !(body?.trim())) return 'Sent a video';
  if (mediaKind === 'image' && !(body?.trim())) return 'Sent a photo';
  if (mediaKind && body?.trim()) return body.trim();
  return body?.trim()?.slice(0, 140) ?? 'Say hello 👋';
}

export default function MessagesInboxScreen() {
  const tabBarScroll = useTabBarScrollProps();
  const { user } = useAuth();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [convIds, setConvIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [inboxReady, setInboxReady] = useState(false);
  const loadInboxRef = useRef<() => Promise<void>>(async () => {});
  const inboxChannelRunRef = useRef(0);

  const [engagementItems, setEngagementItems] = useState<EngagementCarouselItem[]>([]);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementPresence, setEngagementPresence] = useState<Record<string, DbUserPresence>>({});

  const loadEngagementCarousel = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setEngagementItems([]);
      setEngagementPresence({});
      setEngagementLoading(false);
      return;
    }
    setEngagementLoading(true);
    try {
      const data = await fetchFeedEngagementCarousel(user.id);
      setEngagementItems(data);
      const peerIds = [...new Set(data.map((i) => i.otherUserId))];
      if (peerIds.length > 0) {
        const map = await fetchPresenceMap(peerIds);
        setEngagementPresence(map);
      } else {
        setEngagementPresence({});
      }
    } catch {
      setEngagementItems([]);
      setEngagementPresence({});
    } finally {
      setEngagementLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadEngagementCarousel();
    }, [loadEngagementCarousel])
  );

  const loadInbox = useCallback(async () => {
    try {
      if (!user || !isSupabaseConfigured) {
        setRows([]);
        setConvIds([]);
        return;
      }
      const readMap = await getLastReadMap();

      const { data: groupMemberships } = await supabase
        .from('group_chat_members')
        .select('conversation_id')
        .eq('user_id', user.id)
        .is('removed_at', null);

      const groupConvIds = [...new Set((groupMemberships ?? []).map((r) => r.conversation_id as string))];

      const dmFilter = `user_a.eq.${user.id},user_b.eq.${user.id}`;
      let convQuery = supabase.from('conversations').select('id, user_a, user_b, created_at, is_group_chat, group_name, group_avatar_url, plan_id');
      if (groupConvIds.length > 0) {
        convQuery = convQuery.or(`${dmFilter},id.in.(${groupConvIds.join(',')})`);
      } else {
        convQuery = convQuery.or(dmFilter);
      }
      const { data: convs, error: ce } = await convQuery;
      if (ce || !convs?.length) {
        setRows([]);
        setConvIds([]);
        return;
      }

      const ids = convs.map((c) => c.id);
      setConvIds(ids);

      const { data: allLast, error: le } = await supabase
        .from('messages')
        .select('id, conversation_id, text, body, media_id, sender_id, created_at, deleted_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false });

      if (le) {
        setRows([]);
        return;
      }

      const lastByConv = new Map<string, (typeof allLast)[0]>();
      for (const m of allLast ?? []) {
        if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
      }

      const lastRows = [...lastByConv.values()];
      const lastMsgIds = lastRows.map((m) => m.id);

      let deletedForMeIds = new Set<string>();
      if (lastMsgIds.length > 0) {
        const { data: myDeletions } = await supabase
          .from('message_user_deletions')
          .select('message_id')
          .eq('user_id', user.id)
          .in('message_id', lastMsgIds);
        deletedForMeIds = new Set((myDeletions ?? []).map((d) => d.message_id as string));
      }

      const lastMediaFkIds = [...new Set(lastRows.map((m) => m.media_id).filter(Boolean))] as string[];
      const mediaKindByMsg = new Map<string, 'image' | 'video'>();
      if (lastMsgIds.length > 0) {
        const { data: byParent } = await supabase
          .from('media')
          .select('parent_id, mime_type')
          .eq('parent_table', 'messages')
          .in('parent_id', lastMsgIds);
        for (const row of byParent ?? []) {
          const mime = row.mime_type ?? '';
          const kind = mime.startsWith('video/') ? 'video' : 'image';
          if (row.parent_id) mediaKindByMsg.set(row.parent_id, kind);
        }
      }
      if (lastMediaFkIds.length > 0) {
        const { data: byId } = await supabase.from('media').select('id, mime_type').in('id', lastMediaFkIds);
        const kindByMediaId = new Map<string, 'image' | 'video'>();
        for (const row of byId ?? []) {
          const mime = row.mime_type ?? '';
          kindByMediaId.set(row.id as string, mime.startsWith('video/') ? 'video' : 'image');
        }
        for (const last of lastRows) {
          if (last.media_id && !mediaKindByMsg.has(last.id)) {
            const k = kindByMediaId.get(last.media_id);
            if (k) mediaKindByMsg.set(last.id, k);
          }
        }
      }

      const dmConvs = convs.filter((c) => !c.is_group_chat);
      const groupConvs = convs.filter((c) => c.is_group_chat);

      const groupMemberCounts = new Map<string, number>();
      const groupMemberPreviews = new Map<string, { avatarUrl: string | null; name: string }[]>();
      if (groupConvs.length > 0) {
        const gIds = groupConvs.map((c) => c.id);
        const { data: gMembers } = await supabase
          .from('group_chat_members')
          .select('conversation_id, user_id')
          .in('conversation_id', gIds)
          .is('removed_at', null);
        const memberUserIds = [...new Set((gMembers ?? []).map((m) => m.user_id as string))];
        const { data: gProfiles } = memberUserIds.length
          ? await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', memberUserIds)
          : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };
        const gProfMap = new Map((gProfiles ?? []).map((p) => [p.user_id as string, p]));
        for (const gid of gIds) {
          const rows = (gMembers ?? []).filter((m) => m.conversation_id === gid);
          groupMemberCounts.set(gid, rows.length);
          groupMemberPreviews.set(
            gid,
            rows.slice(0, 4).map((m) => {
              const p = gProfMap.get(m.user_id as string);
              return {
                avatarUrl: (p?.avatar_url as string | null) ?? null,
                name: (p?.display_name as string) ?? 'Member',
              };
            })
          );
        }
      }

      const otherIds = dmConvs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a)).filter(Boolean) as string[];
      const uniqueOthers = [...new Set(otherIds)];

      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, verified_badge')
        .in('user_id', uniqueOthers);

      const profByUser = new Map((profs ?? []).map((p) => [p.user_id, p]));

      const out: InboxRow[] = convs.map((c) => {
        const isGroup = !!c.is_group_chat;
        const otherId = isGroup ? c.id : (c.user_a === user.id ? c.user_b : c.user_a)!;
        const prof = isGroup ? null : profByUser.get(otherId);
        const last = lastByConv.get(c.id);
        const mk = last ? mediaKindByMsg.get(last.id) ?? null : null;
        const preview = last && deletedForMeIds.has(last.id)
          ? 'Message deleted'
          : previewForLast(
              last ? messageDisplayText(last) : null,
              mk,
              last?.deleted_at ?? null
            );
        const timeIso = last?.created_at ?? c.created_at;
        const readAt = readMap[c.id];
        const unread =
          !!last &&
          last.sender_id !== user.id &&
          (!readAt || new Date(last.created_at) > new Date(readAt));

        return {
          id: c.id,
          otherId,
          name: isGroup ? (c.group_name ?? 'Group chat') : (prof?.display_name ?? 'Member'),
          avatarUrl: isGroup ? null : (prof?.avatar_url ?? null),
          verified: isGroup ? false : !!prof?.verified_badge,
          preview: isGroup && !last ? `${groupMemberCounts.get(c.id) ?? 0} members` : preview,
          timeIso,
          unread,
          isGroupChat: isGroup,
          groupAvatarUrl: c.group_avatar_url ?? null,
          memberCount: groupMemberCounts.get(c.id),
          memberPreviews: groupMemberPreviews.get(c.id),
        };
      });

      out.sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime());
      setRows(out);
    } finally {
      setInboxReady(true);
    }
  }, [user]);

  loadInboxRef.current = loadInbox;

  useEffect(() => {
    setInboxReady(false);
  }, [user?.id]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    inboxChannelRunRef.current += 1;
    const topic = `inbox-user:${user.id}:${inboxChannelRunRef.current}`;
    const ch = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          void loadInboxRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          void loadInboxRef.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const unreadTotal = useMemo(() => rows.filter((r) => r.unread).length, [rows]);

  const inboxLoading = !inboxReady;

  const listHeader = useMemo(() => {
    if (inboxLoading) return null;
    return (
      <View style={styles.listHeader}>
        <PlanEngagementStrip
          items={engagementItems}
          loading={engagementLoading}
          presenceByUser={engagementPresence}
        />
        {rows.length > 0 ? (
          <View style={styles.recentWrap}>
            <View style={styles.recentPill}>
              <LinearGradient
                colors={['rgba(108,99,255,0.15)', 'rgba(255,101,132,0.12)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="flame-outline" size={17} color={colors.secondary} />
              <Text style={styles.recentLabel}>Recent</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }, [engagementItems, engagementLoading, engagementPresence, inboxLoading, rows.length]);

  return (
    <Screen
      safeAreaEdges={['top', 'left', 'right']}
      safeAreaStyle={styles.screenBg}
      style={styles.screenBg}
    >
      <LinearGradient
        colors={['#EDE8FF', '#FFF5F8', '#E8FAF4', colors.discoveryGradientBottom]}
        locations={[0, 0.28, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      />
      <View style={styles.heroHeader}>
        <View style={styles.heroLeft}>
          <LinearGradient
            colors={[colors.primary, '#8B7CFF', colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <Ionicons name="chatbubbles" size={22} color="#fff" />
          </LinearGradient>
          <View style={styles.heroTitleBlock}>
            <Text style={styles.heroKicker}>Your inbox</Text>
            <Text style={styles.heroTitle}>Chats</Text>
            <Text style={styles.heroSub}>Straightforward chats with people you&apos;re connecting with.</Text>
          </View>
        </View>
        {unreadTotal > 0 ? (
          <LinearGradient
            colors={[colors.secondary, '#FF8FA8', colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.unreadBadge}
          >
            <Text style={styles.unreadBadgeTxt}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
          </LinearGradient>
        ) : null}
      </View>

      <Animated.FlatList
        data={inboxLoading ? [] : rows}
        keyExtractor={(r) => r.id}
        style={styles.listFlex}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        {...tabBarScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void Promise.all([loadInbox(), loadEngagementCarousel()]).finally(() =>
                setRefreshing(false)
              );
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          inboxLoading ? (
            <MessagesInboxSkeleton />
          ) : (
            <MessagesEmptyState onBrowsePlansPress={() => router.push('/(tabs)' as Href)} />
          )
        }
        renderItem={({ item }) => (
          <ConversationCard
            name={item.name}
            avatarUrl={item.avatarUrl}
            preview={item.preview}
            timeLabel={formatRelativeShort(item.timeIso)}
            unread={item.unread}
            verified={item.verified}
            isGroupChat={item.isGroupChat}
            groupAvatarUrl={item.groupAvatarUrl}
            memberCount={item.memberCount}
            memberPreviews={item.memberPreviews}
            onPress={() =>
              router.push(
                (item.isGroupChat ? `/chat/group/${item.id}` : `/chat/${item.id}`) as Href
              )
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenBg: { backgroundColor: 'transparent' },
  gradientBg: { ...StyleSheet.absoluteFillObject },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flex: 1 },
  heroBadge: {
    width: 48,
    height: 48,
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
  heroTitleBlock: { flex: 1 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 21,
  },
  unreadBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  unreadBadgeTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  listFlex: { flex: 1 },
  listContent: { paddingBottom: spacing.xl * 2, flexGrow: 1 },
  listHeader: { paddingBottom: spacing.xs },
  recentWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  recentPill: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  recentLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
