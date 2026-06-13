/**
 * S1 — Support & help: quick topics, tickets (open / resolved), contact flow.
 * Visual shell aligned with Notification Inbox (gradient, glass nav, list rows). No settings icon in header.
 */
import { Button } from '@/components/Button';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbSupportTicket, TicketStatus } from '@/types/database';
import { Href, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const SUBJECT_OPTIONS = [
  'Payment & escrow',
  'Account & verification',
  'Safety & reports',
  'Bug or app issue',
  'Something else',
] as const;

type IonName = ComponentProps<typeof Ionicons>['name'];

const PAYMENT_HELP_COPY = `If money is stuck in escrow after a meetup issue, open a dispute from your escrow screen — this holds the funds while we review it.

For misconduct, scams, or safety concerns on a plan you attended, use the plan dispute option (video evidence required).

For billing questions or other payment queries, send us a support ticket here.`;

const HELP_CARDS: { title: string; body: string; icon: IonName; onPress?: () => void }[] = [
  {
    title: 'Payment issues',
    body: PAYMENT_HELP_COPY,
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

type ActiveEscrowSnippet = { id: string; plan_id: string; status: string };

export default function SupportHomeScreen() {
  const { user, dbUser } = useAuth();
  const effectiveTier = resolveClientEffectiveTier(dbUser);
  const [tickets, setTickets] = useState<DbSupportTicket[]>([]);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [conciergeModalOpen, setConciergeModalOpen] = useState(false);
  const [disambigOpen, setDisambigOpen] = useState(false);
  const [activeEscrows, setActiveEscrows] = useState<ActiveEscrowSnippet[]>([]);
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

  function proceedToTicketForm(topic: string) {
    setSubject(topic);
    setModalOpen(true);
  }

  async function handlePaymentTopicSelect() {
    if (!user) return;
    const { data: rows } = await supabase
      .from('escrow_transactions')
      .select('id, plan_id, status')
      .in('status', ['pending_funding', 'funded', 'disputed', 'active'])
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`)
      .limit(3);
    if (rows && rows.length > 0) {
      setActiveEscrows(rows as ActiveEscrowSnippet[]);
      setDisambigOpen(true);
    } else {
      proceedToTicketForm('Payment & escrow');
    }
  }

  async function submitTicket(opts?: { concierge?: boolean }) {
    if (!user || !body.trim()) {
      Alert.alert('Support', 'Please describe what you need help with.');
      return;
    }
    setSubmitting(true);
    const trimmed = body.trim();
    const isConcierge = !!opts?.concierge;
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: isConcierge ? `Concierge: ${trimmed.substring(0, 50)}` : subject.trim(),
      body: trimmed,
      is_concierge: isConcierge,
      queue_priority: isConcierge ? 1 : undefined,
      sla_hours: isConcierge ? 2 : undefined,
      sla_deadline: isConcierge
        ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        : undefined,
      priority: isConcierge ? 'urgent' : undefined,
    });
    setSubmitting(false);
    if (error) Alert.alert('Support', error.message);
    else {
      setBody('');
      setModalOpen(false);
      setConciergeModalOpen(false);
      void load();
      Alert.alert(
        'Sent',
        isConcierge
          ? 'Your concierge request is in — we aim to respond within 2 hours.'
          : 'We’ve received your message and will get back to you.'
      );
    }
  }

  return (
    <>
      <SettingsStickyShell
        safeAreaEdges={['top', 'left', 'right', 'bottom']}
        contentContainerStyle={styles.scroll}
      >
          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Support</Text>
              <Text style={styles.leadTitle}>Support & help</Text>
              <Text style={styles.leadSub}>We’re here to help you — quick answers below or open a ticket anytime.</Text>
            </View>
          </View>

          {effectiveTier === 'PLATINUM' ? (
            <View style={styles.conciergeOuter}>
              <LinearGradient
                colors={['rgba(124, 77, 255, 0.22)', 'rgba(232, 234, 246, 0.9)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.conciergeBorder}
              >
                <View style={styles.conciergeInner}>
                  <View style={styles.conciergeHeader}>
                    <TierBadge tier="PLATINUM" compact />
                    <Text style={styles.conciergeTitle}>Platinum Concierge</Text>
                  </View>
                  <Text style={styles.conciergeDesc}>
                    Priority human-agent support with a 2-hour response commitment.
                  </Text>
                  <View style={styles.conciergeSlaRow}>
                    <Ionicons name="time-outline" size={14} color="#5E35B1" />
                    <Text style={styles.conciergeSlaText}>Typically responds within 2 hours</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.conciergeBtn, pressed && styles.ctaPressed]}
                    onPress={() => setConciergeModalOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Contact concierge"
                  >
                    <Text style={styles.conciergeBtnLabel}>Contact concierge</Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </View>
          ) : null}

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Quick help</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <LinearGradient
            colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardOuter}
          >
            <View style={styles.cardInner}>
              {HELP_CARDS.map((c, i) => (
                <Pressable
                  key={c.title}
                  style={({ pressed }) => [
                    styles.helpRow,
                    i < HELP_CARDS.length - 1 && styles.helpRowDivider,
                    pressed && styles.helpRowPressed,
                  ]}
                  onPress={() => {
                    if (c.onPress) c.onPress();
                    else if (c.title === 'Payment issues') Alert.alert(c.title, PAYMENT_HELP_COPY);
                    else Alert.alert(c.title, c.body);
                  }}
                >
                  <View style={styles.helpIconWrap}>
                    <Ionicons name={c.icon} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.helpTextCol}>
                    <Text style={styles.helpRowTitle}>{c.title}</Text>
                    <Text style={styles.helpRowBody} numberOfLines={2}>
                      {c.body}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </LinearGradient>

          <View style={styles.ctaWrap}>
            <Pressable
              onPress={() => setModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
              style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
            >
              <LinearGradient
                colors={[colors.primary, '#8B7CE8', colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGrad}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
                <Text style={styles.ctaLabel}>Contact support</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Your tickets</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <View style={styles.tabs}>
            {(['open', 'resolved'] as const).map((t) => {
              const on = tab === t;
              const label = t === 'open' ? 'Open' : 'Resolved';
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={styles.tabHit}
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
                      <Text style={styles.tabTxtOn}>{label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tabIdle}>
                      <Text style={styles.tabTxt}>{label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCardOuter}>
              <LinearGradient
                colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyCardBorder}
              >
                <View style={styles.emptyCardInner}>
                  <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.emptyIconGrad}>
                    <Ionicons name="file-tray-outline" size={26} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>
                    {tab === 'open' ? 'No open tickets' : 'No resolved tickets yet'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {tab === 'open'
                      ? 'Tap Contact support when you need us — we read every message.'
                      : 'Closed and resolved requests will appear here.'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <LinearGradient
              colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardOuter}
            >
              <View style={styles.cardInner}>
                {filtered.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/support/ticket/${item.id}` as Href)}
                    style={({ pressed }) => [
                      styles.ticketRow,
                      i < filtered.length - 1 ? styles.ticketRowDivider : undefined,
                      pressed && styles.helpRowPressed,
                    ]}
                  >
                    <Text style={styles.ticketTitle} numberOfLines={2}>
                      {item.subject}
                    </Text>
                    <View style={styles.ticketMeta}>
                      <View style={[styles.pill, isOpenTab(item.status) ? styles.pillOpen : styles.pillDone]}>
                        <Text style={[styles.pillTxt, isOpenTab(item.status) ? styles.pillTxtOpen : styles.pillTxtDone]}>
                          {statusLabel(item.status)}
                        </Text>
                      </View>
                      <Text style={styles.ticketDate}>
                        Updated {new Date(item.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </LinearGradient>
          )}

          <Pressable style={styles.disputesLink} onPress={() => router.push('/disputes' as Href)}>
            <Text style={styles.disputesLinkTxt}>View escrow disputes</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
      </SettingsStickyShell>

        <Modal visible={modalOpen} animationType="slide" transparent statusBarTranslucent>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={['#FBFAFF', '#F5F3FF']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <Text style={styles.modalTitle}>Contact support</Text>
              <Text style={styles.modalSub}>We’ll email you from the address on your account.</Text>
              <Text style={styles.inputLabel}>Topic</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                <View style={styles.chipsRow}>
                  {SUBJECT_OPTIONS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => {
                        if (s === 'Payment & escrow') void handlePaymentTopicSelect();
                        else setSubject(s);
                      }}
                      style={styles.chipHit}
                    >
                      {subject === s ? (
                        <LinearGradient
                          colors={[colors.primary, '#8B7CE8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.chipGrad}
                        >
                          <Text style={styles.chipTxtOnWhite}>{s}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.chipIdle}>
                          <Text style={styles.chipTxt}>{s}</Text>
                        </View>
                      )}
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

        <Modal visible={conciergeModalOpen} animationType="slide" transparent statusBarTranslucent>
          <Pressable style={styles.modalBackdrop} onPress={() => setConciergeModalOpen(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={['#F3EFFF', '#EDE8FF']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <View style={styles.conciergeModalHead}>
                <TierBadge tier="PLATINUM" compact />
                <Text style={styles.modalTitle}>Concierge Support</Text>
              </View>
              <Text style={styles.modalSub}>Describe anything — a concierge agent will take it from here.</Text>
              <Text style={styles.conciergeSlaReminder}>We&apos;ll respond within 2 hours.</Text>
              <Text style={styles.inputLabel}>What do you need?</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Tell us what you need — no topic required."
                placeholderTextColor={colors.textMuted}
                multiline
                value={body}
                onChangeText={setBody}
                textAlignVertical="top"
              />
              <Button title="Send to concierge" onPress={() => void submitTicket({ concierge: true })} loading={submitting} />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setConciergeModalOpen(false)}
                style={{ marginTop: spacing.sm }}
              />
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={disambigOpen} animationType="slide" transparent statusBarTranslucent>
          <Pressable style={styles.disambigBackdrop} onPress={() => setDisambigOpen(false)}>
            <Pressable style={styles.disambigSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.disambigHandle} />
              <Text style={styles.disambigTitle}>What&apos;s the issue?</Text>
              <Text style={styles.disambigSub}>
                You have active escrow — pick the path that matches your situation.
              </Text>

              <Pressable
                style={styles.disambigOption}
                onPress={() => {
                  setDisambigOpen(false);
                  const esc = activeEscrows[0];
                  if (esc) router.push(`/escrow/${esc.id}` as Href);
                }}
              >
                <View style={styles.disambigOptionText}>
                  <Text style={styles.disambigOptionTitle}>Money stuck / wrong amount in escrow</Text>
                  <Text style={styles.disambigOptionDesc}>
                    Go to your escrow screen to dispute and hold the funds.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.disambigOption}
                onPress={() => {
                  setDisambigOpen(false);
                  const esc = activeEscrows[0];
                  if (esc?.plan_id) router.push(`/dispute/${esc.plan_id}` as Href);
                }}
              >
                <View style={styles.disambigOptionText}>
                  <Text style={styles.disambigOptionTitle}>Misconduct, scam, or safety concern</Text>
                  <Text style={styles.disambigOptionDesc}>
                    File a plan dispute with evidence (video required).
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.disambigOption}
                onPress={() => {
                  setDisambigOpen(false);
                  proceedToTicketForm('Payment & escrow');
                }}
              >
                <View style={styles.disambigOptionText}>
                  <Text style={styles.disambigOptionTitle}>Something else — contact support</Text>
                  <Text style={styles.disambigOptionDesc}>A support agent will help you.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
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
  sectionHead: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionHeadSpaced: {
    marginTop: spacing.md,
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
    flex: 1,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  cardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  helpRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
  },
  helpRowPressed: {
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  helpIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  helpTextCol: { flex: 1, minWidth: 0 },
  helpRowTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  helpRowBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 4, fontWeight: '600' },
  ctaWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  ctaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 54,
    alignSelf: 'stretch',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#6C63FF',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
        }
      : { elevation: 5 }),
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.97 }],
  },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    minHeight: 54,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tabHit: {
    flex: 1,
    minWidth: 120,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  tabGrad: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  tabIdle: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
    alignItems: 'center',
  },
  tabTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  tabTxtOn: { fontSize: 14, fontWeight: '900', color: '#fff' },
  loader: { marginVertical: spacing.lg },
  emptyCardOuter: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
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
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.25,
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
  ticketRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  ticketRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
  },
  ticketTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.button },
  pillOpen: { backgroundColor: 'rgba(108, 99, 255, 0.12)', borderWidth: 1, borderColor: 'rgba(108, 99, 255, 0.22)' },
  pillDone: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.22)' },
  pillTxt: { fontSize: 12, fontWeight: '800' },
  pillTxtOpen: { color: colors.primary },
  pillTxtDone: { color: '#059669' },
  ticketDate: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  disputesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 4,
    paddingBottom: spacing.md,
  },
  disputesLinkTxt: { fontSize: 16, fontWeight: '800', color: colors.primary },
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
    overflow: 'hidden',
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: spacing.xs, letterSpacing: -0.3 },
  modalSub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20, fontWeight: '600' },
  inputLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  chipsScroll: { marginBottom: spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipHit: { borderRadius: radius.button, overflow: 'hidden' },
  chipGrad: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipIdle: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipTxtOnWhite: { fontSize: 13, fontWeight: '900', color: '#fff' },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  conciergeOuter: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  conciergeBorder: {
    borderRadius: radius.xl,
    padding: 2,
  },
  conciergeInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 53, 177, 0.18)',
  },
  conciergeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  conciergeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#5E35B1',
    letterSpacing: -0.2,
  },
  conciergeDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  conciergeSlaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  conciergeSlaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5E35B1',
  },
  conciergeBtn: {
    backgroundColor: '#7C4DFF',
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  conciergeBtnLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  conciergeModalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  conciergeSlaReminder: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5E35B1',
    marginBottom: spacing.md,
  },
  disambigBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  disambigSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  disambigHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  disambigTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  disambigSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  disambigOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    marginBottom: spacing.sm,
  },
  disambigOptionText: { flex: 1, minWidth: 0 },
  disambigOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  disambigOptionDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 19,
  },
});
