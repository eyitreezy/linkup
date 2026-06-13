/**
 * Member ticket detail — thread + reply composer.
 */
import { Button } from '@/components/Button';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { TicketReplyBubble } from '@/components/support/TicketReplyBubble';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbSupportTicket, DbTicketReply, TicketStatus } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function statusLabel(s: TicketStatus): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return s;
  }
}

function statusStyle(s: TicketStatus): { bg: string; fg: string } {
  if (s === 'resolved' || s === 'closed') {
    return { bg: 'rgba(16, 185, 129, 0.12)', fg: '#059669' };
  }
  if (s === 'in_progress') {
    return { bg: 'rgba(245, 158, 11, 0.14)', fg: '#B45309' };
  }
  return { bg: 'rgba(108, 99, 255, 0.12)', fg: colors.primary };
}

export default function SupportTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<DbSupportTicket | null>(null);
  const [replies, setReplies] = useState<DbTicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const canReply = useMemo(
    () => ticket?.status === 'open' || ticket?.status === 'in_progress',
    [ticket?.status]
  );

  const load = useCallback(async () => {
    if (!id || !user || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true }),
    ]);
    setTicket((t as DbSupportTicket) ?? null);
    setReplies((r as DbTicketReply[]) ?? []);
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`ticket-replies-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_replies', filter: `ticket_id=eq.${id}` },
        (payload) => {
          const row = payload.new as DbTicketReply;
          if (row.is_internal) return;
          setReplies((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  async function sendReply() {
    if (!user?.id || !id || !replyText.trim() || !canReply) return;
    setSending(true);
    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: id,
      sender_id: user.id,
      sender_role: 'member',
      body: replyText.trim(),
      is_internal: false,
    });
    setSending(false);
    if (!error) {
      setReplyText('');
      void load();
    }
  }

  if (loading) {
    return (
      <SettingsStickyShell>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </SettingsStickyShell>
    );
  }

  if (!ticket) {
    return (
      <SettingsStickyShell>
        <Text style={styles.emptyTitle}>Ticket not found</Text>
        <Button title="Back to support" variant="ghost" onPress={() => router.back()} />
      </SettingsStickyShell>
    );
  }

  const st = statusStyle(ticket.status);
  const threadData: Array<{ kind: 'seed' | 'reply'; reply?: DbTicketReply }> = [
    { kind: 'seed' },
    ...replies.map((reply) => ({ kind: 'reply' as const, reply })),
  ];

  return (
    <SettingsStickyShell safeAreaEdges={['top', 'left', 'right', 'bottom']} contentContainerStyle={styles.scroll}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Ticket</Text>
        <View style={[styles.pill, { backgroundColor: st.bg }]}>
          <Text style={[styles.pillTxt, { color: st.fg }]}>{statusLabel(ticket.status)}</Text>
        </View>
      </View>

      <LinearGradient
        colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardOuter}
      >
        <View style={styles.cardInner}>
          <Text style={styles.subject}>{ticket.subject}</Text>
          <Text style={styles.meta}>
            Opened {new Date(ticket.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </Text>
        </View>
      </LinearGradient>

      <FlatList
        data={threadData}
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) =>
          item.kind === 'seed' ? (
            <View style={styles.seedBubble}>
              <Text style={styles.seedLbl}>Your message</Text>
              <Text style={styles.seedBody}>{ticket.body}</Text>
            </View>
          ) : item.reply ? (
            <TicketReplyBubble reply={item.reply} />
          ) : null
        }
        ListEmptyComponent={null}
      />

      {canReply ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Add a reply…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
          <Button title="Send" onPress={() => void sendReply()} loading={sending} disabled={!replyText.trim()} />
        </View>
      ) : (
        <Text style={styles.closedHint}>This ticket is closed. Open a new request from Support if you need more help.</Text>
      )}
    </SettingsStickyShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  topTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: colors.text },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.button },
  pillTxt: { fontSize: 12, fontWeight: '800' },
  cardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  subject: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  meta: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  seedBubble: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.18)',
    padding: spacing.md,
  },
  seedLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  seedBody: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 22 },
  composer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  closedHint: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginVertical: spacing.lg,
  },
});
