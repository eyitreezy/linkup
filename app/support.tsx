/**
 * S1 — Support & help: quick topics, tickets (open / resolved), contact flow.
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbSupportTicket, TicketStatus } from '@/types/database';
import { Href, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SUBJECT_OPTIONS = [
  'Payment & escrow',
  'Account & verification',
  'Safety & reports',
  'Bug or app issue',
  'Something else',
] as const;

type IonName = ComponentProps<typeof Ionicons>['name'];

const HELP_CARDS: { title: string; body: string; icon: IonName; onPress?: () => void }[] = [
  {
    title: 'Payment issues',
    body: 'Escrow holds your payment until the meetup is confirmed. Open a dispute from escrow if something’s wrong.',
    icon: 'card-outline',
  },
  {
    title: 'Account verification',
    body: 'Verified members unlock plans, negotiation, and funding escrow — it only takes a few minutes.',
    icon: 'shield-checkmark-outline',
    onPress: () => router.push('/kyc' as Href),
  },
  {
    title: 'Safety & reports',
    body: 'Your safety matters. Share details in a ticket and we’ll review with care.',
    icon: 'heart-outline',
  },
];

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

function isOpenTab(s: TicketStatus): boolean {
  return s === 'open' || s === 'in_progress';
}

export default function SupportHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<DbSupportTicket[]>([]);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setLoading(false);
    if (error) Alert.alert('Support', error.message);
    else setTickets((data as DbSupportTicket[]) ?? []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(
    () => tickets.filter((t) => (tab === 'open' ? isOpenTab(t.status) : !isOpenTab(t.status))),
    [tickets, tab]
  );

  async function submitTicket() {
    if (!user || !body.trim()) {
      Alert.alert('Support', 'Please describe what you need help with.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: subject.trim(),
      body: body.trim(),
    });
    setSubmitting(false);
    if (error) Alert.alert('Support', error.message);
    else {
      setBody('');
      setModalOpen(false);
      void load();
      Alert.alert('Sent', 'We’ve received your message and will get back to you.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={[styles.top, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Support & help</Text>
          <Text style={styles.sub}>We’re here to help you</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Quick help</Text>
        <View style={styles.helpGrid}>
          {HELP_CARDS.map((c) => (
            <Pressable
              key={c.title}
              style={styles.helpCard}
              onPress={() => {
                if (c.onPress) c.onPress();
                else Alert.alert(c.title, c.body);
              }}
            >
              <View style={styles.helpIcon}>
                <Ionicons name={c.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.helpTitle}>{c.title}</Text>
              <Text style={styles.helpBody} numberOfLines={3}>
                {c.body}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button title="Contact support" onPress={() => setModalOpen(true)} style={{ marginBottom: spacing.lg }} />

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'open' && styles.tabOn]} onPress={() => setTab('open')}>
            <Text style={[styles.tabTxt, tab === 'open' && styles.tabTxtOn]}>Open</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'resolved' && styles.tabOn]} onPress={() => setTab('resolved')}>
            <Text style={[styles.tabTxt, tab === 'resolved' && styles.tabTxtOn]}>Resolved</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <FlatList
            data={filtered}
            scrollEnabled={false}
            keyExtractor={(t) => t.id}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {tab === 'open' ? 'No open tickets.' : 'No resolved tickets yet.'}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.ticketCard}>
                <Text style={styles.ticketTitle}>{item.subject}</Text>
                <View style={styles.ticketMeta}>
                  <View style={[styles.pill, isOpenTab(item.status) ? styles.pillOpen : styles.pillDone]}>
                    <Text style={styles.pillTxt}>{statusLabel(item.status)}</Text>
                  </View>
                  <Text style={styles.ticketDate}>
                    Updated {new Date(item.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        <Pressable style={styles.disputesLink} onPress={() => router.push('/disputes' as Href)}>
          <Text style={styles.disputesLinkTxt}>View escrow disputes</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Contact support</Text>
            <Text style={styles.modalSub}>We’ll email you from the address on your account.</Text>
            <Text style={styles.inputLabel}>Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={styles.chipsRow}>
                {SUBJECT_OPTIONS.map((s) => (
                  <Pressable key={s} onPress={() => setSubject(s)} style={[styles.chip, subject === s && styles.chipOn]}>
                    <Text style={[styles.chipTxt, subject === s && styles.chipTxtOn]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.inputLabel}>What’s going on?</Text>
            <TextInput
              style={styles.textarea}
              placeholder="The more detail you share, the faster we can help."
              placeholderTextColor={colors.textMuted}
              multiline
              value={body}
              onChangeText={setBody}
              textAlignVertical="top"
            />
            <Button title="Submit" onPress={() => void submitTicket()} loading={submitting} />
            <Button title="Cancel" variant="ghost" onPress={() => setModalOpen(false)} style={{ marginTop: spacing.sm }} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backWrap: { paddingRight: spacing.sm },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  helpGrid: { gap: spacing.md, marginBottom: spacing.lg },
  helpCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  helpTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  helpBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.full },
  tabOn: { backgroundColor: colors.primary },
  tabTxt: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  tabTxtOn: { color: '#fff' },
  empty: { color: colors.textMuted, paddingVertical: spacing.lg, textAlign: 'center' },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  pillOpen: { backgroundColor: '#EEF2FF' },
  pillDone: { backgroundColor: '#ECFDF5' },
  pillTxt: { fontSize: 12, fontWeight: '800', color: colors.text },
  ticketDate: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  disputesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: 4,
  },
  disputesLinkTxt: { fontSize: 16, fontWeight: '700', color: colors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  modalSub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTxtOn: { color: colors.primary },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
  },
});
