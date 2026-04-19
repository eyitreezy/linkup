/**
 * M1 — Inbox: avatar-first list, rich previews, realtime refresh.
 */
import { ConversationCard } from '@/components/messages/ConversationCard';
import { MessagesEmptyState } from '@/components/messages/MessagesEmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatRelativeShort } from '@/lib/messaging/formatRelative';
import { getLastReadMap } from '@/lib/messaging/inboxCache';
import { messageDisplayText, parseLegacyImageBody } from '@/lib/messaging/chatQueries';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

type InboxRow = {
  id: string;
  otherId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  preview: string;
  timeIso: string;
  unread: boolean;
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
  return body?.trim()?.slice(0, 140) ?? 'Say hello';
}

export default function MessagesInboxScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [convIds, setConvIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [inboxReady, setInboxReady] = useState(false);
  const loadInboxRef = useRef<() => Promise<void>>(async () => {});
  const inboxChannelRunRef = useRef(0);

  const loadInbox = useCallback(async () => {
    try {
      if (!user || !isSupabaseConfigured) {
        setRows([]);
        setConvIds([]);
        return;
      }
      const readMap = await getLastReadMap();

      const { data: convs, error: ce } = await supabase
        .from('conversations')
        .select('id, user_a, user_b, created_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
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

    const otherIds = convs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
    const uniqueOthers = [...new Set(otherIds)];

    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .in('user_id', uniqueOthers);

    const profByUser = new Map((profs ?? []).map((p) => [p.user_id, p]));

    const out: InboxRow[] = convs.map((c) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const prof = profByUser.get(otherId);
      const last = lastByConv.get(c.id);
      const mk = last ? mediaKindByMsg.get(last.id) ?? null : null;
      const preview = previewForLast(
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
        name: prof?.display_name ?? 'User',
        avatarUrl: prof?.avatar_url ?? null,
        verified: !!prof?.verified_badge,
        preview,
        timeIso,
        unread,
      };
    });

      out.sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime());
      setRows(out);
    } finally {
      setInboxReady(true);
    }
  }, [user]);

  loadInboxRef.current = loadInbox;

  const convIdsKey = useMemo(() => [...convIds].sort().join('|'), [convIds]);

  useEffect(() => {
    setInboxReady(false);
  }, [user?.id]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured || convIds.length === 0) return;
    // Unique topic each run: Supabase reuses channels by name; adding `.on()` after `subscribe()` throws.
    inboxChannelRunRef.current += 1;
    const topic = `inbox-msgs:${user.id}:${inboxChannelRunRef.current}`;
    const ch = supabase.channel(topic);
    const slice = convIds.slice(0, 48);
    for (const cid of slice) {
      ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${cid}`,
        },
        () => {
          void loadInboxRef.current();
        }
      );
      ch.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${cid}`,
        },
        () => {
          void loadInboxRef.current();
        }
      );
    }
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, convIdsKey]);

  const unreadTotal = useMemo(() => rows.filter((r) => r.unread).length, [rows]);

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        {unreadTotal > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
          </View>
        ) : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadInbox().finally(() => setRefreshing(false));
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !inboxReady ? (
            <View style={styles.emptyLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
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
            onPress={() => router.push(`/chat/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  list: { paddingBottom: spacing.xl, flexGrow: 1 },
  emptyLoading: { paddingTop: spacing.xl * 2, alignItems: 'center' },
});
