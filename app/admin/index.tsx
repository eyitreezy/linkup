/**
 * Admin — verification (KYC), user reports, moderation audit.
 */
import { AdminPlansPanel } from '@/components/admin/AdminPlansPanel';
import { AdminSupportTicketModal } from '@/components/admin/AdminSupportTicketModal';
import {
  EscrowDisputeResolveModal,
  type EscrowResolveContext,
} from '@/components/admin/EscrowDisputeResolveModal';
import { SlaDeadlineBadge } from '@/components/admin/SlaDeadlineBadge';
import { AdminUsersPanel } from '@/components/admin/AdminUsersPanel';
import { TierBadge } from '@/components/TierBadge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  DbDispute,
  DbDisputeEvidence,
  DbEscrowTransaction,
  DbModerationLog,
  DbReport,
  DbSupportTicket,
  DbVerificationEvent,
  DbVerificationRequest,
} from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type AdminTab = 'verify' | 'reports' | 'moderation' | 'plan_disputes' | 'support' | 'plans' | 'users';

type EscrowDisputeAdminRow = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  escrow_id: string | null;
  opened_by: string | null;
  admin_resolution: string | null;
  support_ticket_id: string | null;
  detail: string | null;
  queue_priority?: number | null;
  sla_deadline?: string | null;
  escrow_row?: Pick<
    DbEscrowTransaction,
    'id' | 'amount_cents' | 'currency' | 'plan_id' | 'payer_id' | 'payee_id' | 'status'
  > | null;
};

type KycProfileSnippet = { display_name: string | null; avatar_url: string | null };

function shortUuid(id: string, len = 8): string {
  return id.length <= len ? id : `${id.slice(0, len)}…`;
}

function formatEscrowAmount(cents: number | undefined, currency: string | undefined): string | null {
  if (cents == null || currency == null) return null;
  const major = cents / 100;
  if (currency === 'NGN') return `₦${major.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${major.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function escrowDisputeStatusStyle(status: string): { bg: string; fg: string; border: string; label: string } {
  const s = status.toLowerCase();
  if (s === 'open') {
    return {
      bg: 'rgba(245,158,11,0.16)',
      fg: '#B45309',
      border: 'rgba(245,158,11,0.35)',
      label: 'Open',
    };
  }
  if (s === 'under_review') {
    return {
      bg: 'rgba(108,99,255,0.14)',
      fg: colors.primary,
      border: 'rgba(108,99,255,0.35)',
      label: 'Under review',
    };
  }
  if (s === 'resolved') {
    return {
      bg: 'rgba(16,185,129,0.14)',
      fg: '#047857',
      border: 'rgba(16,185,129,0.3)',
      label: 'Resolved',
    };
  }
  if (s === 'dismissed') {
    return {
      bg: 'rgba(107,114,128,0.12)',
      fg: colors.textMuted,
      border: colors.border,
      label: 'Dismissed',
    };
  }
  return {
    bg: 'rgba(107,114,128,0.1)',
    fg: colors.textMuted,
    border: colors.border,
    label: status.replace(/_/g, ' '),
  };
}

function ticketStatusStyle(status: string): { bg: string; fg: string; border: string } {
  const s = status.toLowerCase();
  if (s === 'open') return { bg: 'rgba(245,158,11,0.16)', fg: '#B45309', border: 'rgba(245,158,11,0.35)' };
  if (s === 'in_progress') return { bg: 'rgba(108,99,255,0.14)', fg: colors.primary, border: 'rgba(108,99,255,0.35)' };
  if (s === 'resolved') return { bg: 'rgba(16,185,129,0.14)', fg: '#047857', border: 'rgba(16,185,129,0.3)' };
  return { bg: 'rgba(107,114,128,0.1)', fg: colors.textMuted, border: colors.border };
}

type VerRow = Pick<
  DbVerificationRequest,
  | 'id'
  | 'user_id'
  | 'status'
  | 'created_at'
  | 'rejection_reason'
  | 'id_document_path'
  | 'selfie_video_path'
  | 'reviewed_by'
>;

const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function kycStatusStyle(status: string): { bg: string; fg: string; border: string } {
  if (status === 'pending') return { bg: 'rgba(245,158,11,0.18)', fg: '#B45309', border: 'rgba(245,158,11,0.35)' };
  if (status === 'admin_approved') return { bg: 'rgba(16,185,129,0.14)', fg: '#047857', border: 'rgba(16,185,129,0.35)' };
  if (status === 'admin_rejected') return { bg: 'rgba(239,68,68,0.12)', fg: colors.danger, border: 'rgba(239,68,68,0.35)' };
  return { bg: 'rgba(108,99,255,0.1)', fg: colors.primary, border: 'rgba(108,99,255,0.25)' };
}

function reportStatusStyle(status: string): { bg: string; fg: string; border: string } {
  if (status === 'pending') return { bg: 'rgba(255,101,132,0.14)', fg: '#BE185D', border: 'rgba(255,101,132,0.35)' };
  if (status === 'reviewed') return { bg: 'rgba(59,130,246,0.12)', fg: '#1D4ED8', border: 'rgba(59,130,246,0.3)' };
  return { bg: 'rgba(16,185,129,0.12)', fg: '#047857', border: 'rgba(16,185,129,0.3)' };
}

function severityStyle(sev: string): { bg: string; fg: string } {
  if (sev === 'high') return { bg: 'rgba(239,68,68,0.15)', fg: colors.danger };
  if (sev === 'medium') return { bg: 'rgba(245,158,11,0.18)', fg: '#B45309' };
  return { bg: 'rgba(107,114,128,0.12)', fg: colors.textMuted };
}

function moderationFlagLabel(ft: string): string {
  const map: Record<string, string> = {
    spam: 'Spam / noise',
    abuse: 'Harassment / abuse',
    scam: 'Scam / solicitation',
    explicit: 'Explicit content',
    other: 'Unclassified',
  };
  return map[ft] ?? ft.replace(/_/g, ' ');
}

function moderationActionLabel(action: string): string {
  const map: Record<string, string> = {
    none: 'No automated action',
    hidden: 'Hidden or blocked',
    warned: 'Warned (account)',
    banned: 'Banned (account)',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

function moderationContentLabel(ct: string): string {
  if (ct === 'message') return 'Chat message';
  if (ct === 'plan') return 'Meetup plan';
  if (ct === 'profile') return 'Profile text';
  return ct;
}

function moderationContentIcon(ct: string): keyof typeof Ionicons.glyphMap {
  if (ct === 'message') return 'chatbubble-ellipses-outline';
  if (ct === 'plan') return 'albums-outline';
  return 'person-outline';
}

function formatModerationScore(score: number | null): string {
  if (score == null || Number.isNaN(Number(score))) return '—';
  const pct = Math.round(Number(score) * 100);
  return `${pct}% · heuristic`;
}

function moderationAuditSummary(item: DbModerationLog): string {
  const flag = moderationFlagLabel(item.flag_type);
  if (item.severity === 'high' && item.action_taken === 'hidden') {
    return `High severity (${flag}): content was automatically hidden or blocked and admins were notified.`;
  }
  if (item.severity === 'high') {
    return `High severity (${flag}): review recommended; suppression may have failed or was not applicable.`;
  }
  if (item.action_taken === 'hidden') {
    return `${flag}: automated action applied (hidden or blocked).`;
  }
  return `${flag}: logged for audit only; no automatic hide on this event.`;
}

function kycApproveButtonTitle(_status: string, canDecide: boolean): string {
  return canDecide ? 'Approve' : 'Approved';
}

function TabButton({
  label,
  active,
  onPress,
  icon,
  compact,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtnOuter,
        compact && styles.tabBtnOuterCompact,
        active && styles.tabBtnOuterActive,
        pressed && styles.tabBtnPressed,
      ]}
    >
      <View
        style={[
          styles.tabBtnClip,
          compact && styles.tabBtnClipCompact,
          !active && styles.tabBtnIdle,
          active && Platform.OS === 'android' && styles.tabBtnClipActiveAndroid,
        ]}
        collapsable={Platform.OS === 'android' ? false : undefined}
      >
        {active ? (
          <LinearGradient
            key={`${label}-active`}
            colors={[colors.primary, '#8B7CFF', colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.tabBtnInner}>
          {icon ? (
            <Ionicons
              name={icon}
              size={compact ? 15 : 16}
              color={active ? '#fff' : colors.primary}
            />
          ) : null}
          <Text
            style={[
              styles.tabBtnTxt,
              active && styles.tabBtnTxtOn,
              compact && styles.tabBtnTxtCompact,
            ]}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
  style,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeaderBlock, style]}>
      <LinearGradient
        colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sectionIconRing}
      >
        <View style={styles.sectionIconInner}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
      </LinearGradient>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function AdminListCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.adminCard, style]}>
      <LinearGradient
        colors={[colors.secondary, colors.primary, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.adminCardStripe}
      />
      <View style={styles.adminCardBody}>{children}</View>
    </View>
  );
}

export default function AdminScreen() {
  const { isAdmin, adminRecordId } = useAuth();
  const [tab, setTab] = useState<AdminTab>('verify');

  const [ver, setVer] = useState<VerRow[]>([]);
  const [disp, setDisp] = useState<EscrowDisputeAdminRow[]>([]);
  const [tickets, setTickets] = useState<DbSupportTicket[]>([]);
  const [reports, setReports] = useState<DbReport[]>([]);
  const [mods, setMods] = useState<DbModerationLog[]>([]);
  const [modProfiles, setModProfiles] = useState<Record<string, KycProfileSnippet>>({});
  const [modMessagePreview, setModMessagePreview] = useState<Record<string, string>>({});
  const [modPlanTitle, setModPlanTitle] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [kycProfiles, setKycProfiles] = useState<Record<string, KycProfileSnippet>>({});

  const [expandedKyc, setExpandedKyc] = useState<string | null>(null);
  const [kycEvents, setKycEvents] = useState<DbVerificationEvent[]>([]);
  const [kycUrls, setKycUrls] = useState<{ id: string | null; selfie: string | null }>({
    id: null,
    selfie: null,
  });
  const [eventsBusy, setEventsBusy] = useState(false);

  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [reportDetail, setReportDetail] = useState<DbReport | null>(null);
  const [relatedSnippet, setRelatedSnippet] = useState<string | null>(null);

  const [planDisputes, setPlanDisputes] = useState<DbDispute[]>([]);
  const [planDispDetail, setPlanDispDetail] = useState<DbDispute | null>(null);
  const [planDispEvidence, setPlanDispEvidence] = useState<DbDisputeEvidence[]>([]);
  const [planDispNotes, setPlanDispNotes] = useState('');
  const [planDispBusy, setPlanDispBusy] = useState(false);
  const [planDispFilter, setPlanDispFilter] = useState<'open' | 'all'>('open');
  const [planDispPartialPct, setPlanDispPartialPct] = useState('50');
  const [planDispPartialOpen, setPlanDispPartialOpen] = useState(false);
  const [planDispIssueGoodwill, setPlanDispIssueGoodwill] = useState(false);
  const [planDispGoodwillAmount, setPlanDispGoodwillAmount] = useState('');
  const [planDispEscrowCents, setPlanDispEscrowCents] = useState<number | null>(null);
  const [ticketFilter, setTicketFilter] = useState<'open' | 'all'>('open');
  const [ticketDetail, setTicketDetail] = useState<DbSupportTicket | null>(null);
  const [escrowResolveCtx, setEscrowResolveCtx] = useState<EscrowResolveContext | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const { data: v } = await supabase
      .from('verification_requests')
      .select(
        'id, user_id, status, created_at, rejection_reason, id_document_path, selfie_video_path, reviewed_by'
      )
      .order('created_at', { ascending: false })
      .limit(40);
    if (v) {
      const rows = v as VerRow[];
      setVer(rows);
      const uidSet = [...new Set(rows.map((r) => r.user_id))];
      if (uidSet.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', uidSet);
        const map: Record<string, KycProfileSnippet> = {};
        for (const p of profs ?? []) {
          map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
        setKycProfiles(map);
      } else setKycProfiles({});
    } else {
      setVer([]);
      setKycProfiles({});
    }

    const { data: pdi } = await supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (pdi) setPlanDisputes(pdi as DbDispute[]);

    const { data: d } = await supabase
      .from('escrow_disputes')
      .select(
        'id, reason, status, created_at, resolved_at, escrow_id, opened_by, admin_resolution, support_ticket_id, detail, queue_priority'
      )
      .order('queue_priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(40);
    if (d && d.length) {
      const escrowIds = [
        ...new Set(
          d
            .map((x: { escrow_id: string | null }) => x.escrow_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        ),
      ];
      const ticketIds = [
        ...new Set(
          d
            .map((x: { support_ticket_id: string | null }) => x.support_ticket_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        ),
      ];
      let byEscrow: Record<
        string,
        Pick<
          DbEscrowTransaction,
          'id' | 'amount_cents' | 'currency' | 'plan_id' | 'payer_id' | 'payee_id' | 'status'
        >
      > = {};
      if (escrowIds.length) {
        const { data: escrows } = await supabase
          .from('escrow_transactions')
          .select('id, amount_cents, currency, plan_id, payer_id, payee_id, status')
          .in('id', escrowIds);
        for (const e of escrows ?? []) byEscrow[e.id] = e as (typeof byEscrow)[string];
      }
      let slaByTicket: Record<string, string> = {};
      if (ticketIds.length) {
        const { data: linkedTickets } = await supabase
          .from('support_tickets')
          .select('id, sla_deadline')
          .in('id', ticketIds);
        for (const tk of linkedTickets ?? []) {
          if (tk.sla_deadline) slaByTicket[tk.id] = tk.sla_deadline as string;
        }
      }
      setDisp(
        d.map((row) => ({
          ...(row as EscrowDisputeAdminRow),
          escrow_row: row.escrow_id ? byEscrow[row.escrow_id] ?? null : null,
          sla_deadline: row.support_ticket_id ? slaByTicket[row.support_ticket_id] ?? null : null,
        }))
      );
    } else setDisp([]);

    const { data: t } = await supabase
      .from('support_tickets')
      .select(
        'id, user_id, subject, body, status, priority, queue_priority, sla_deadline, is_concierge, created_at, updated_at'
      )
      .order('queue_priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(120);
    if (t) setTickets(t as DbSupportTicket[]);

    const { data: r } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (r) setReports(r as DbReport[]);

    const { data: m } = await supabase.from('moderation_logs').select('*').order('created_at', { ascending: false }).limit(120);
    if (m?.length) {
      const rows = m as DbModerationLog[];
      rows.sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
      setMods(rows);

      const modUserIds = [...new Set(rows.map((r) => r.user_id))];
      if (modUserIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', modUserIds);
        const pmap: Record<string, KycProfileSnippet> = {};
        for (const p of profs ?? []) {
          pmap[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
        setModProfiles(pmap);
      } else setModProfiles({});

      const messageIds = [...new Set(rows.filter((r) => r.content_type === 'message').map((r) => r.content_id))];
      const msgMap: Record<string, string> = {};
      if (messageIds.length) {
        const { data: msgs } = await supabase.from('messages').select('id, text, body').in('id', messageIds);
        for (const row of msgs ?? []) {
          const r = row as { id: string; text: string | null; body: string | null };
          const blob = r.text ?? r.body;
          if (typeof blob === 'string' && blob.trim()) msgMap[r.id] = blob.trim().slice(0, 320);
        }
      }
      setModMessagePreview(msgMap);

      const planIds = [...new Set(rows.filter((r) => r.content_type === 'plan').map((r) => r.content_id))];
      const planMap: Record<string, string> = {};
      if (planIds.length) {
        const { data: plans } = await supabase.from('plans').select('id, title').in('id', planIds);
        for (const row of plans ?? []) {
          const r = row as { id: string; title: string | null };
          const t = r.title?.trim();
          if (t) planMap[r.id] = t.slice(0, 160);
        }
      }
      setModPlanTitle(planMap);
    } else {
      setMods([]);
      setModProfiles({});
      setModMessagePreview({});
      setModPlanTitle({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadKycExtras = useCallback(async (row: VerRow) => {
    setEventsBusy(true);
    setKycUrls({ id: null, selfie: null });
    const [{ data: ev }, idSigned, vidSigned] = await Promise.all([
      supabase
        .from('verification_events')
        .select('*')
        .eq('verification_id', row.id)
        .order('created_at', { ascending: true }),
      row.id_document_path
        ? supabase.storage.from('verification').createSignedUrl(row.id_document_path, 3600)
        : Promise.resolve({ data: null }),
      row.selfie_video_path
        ? supabase.storage.from('verification').createSignedUrl(row.selfie_video_path, 3600)
        : Promise.resolve({ data: null }),
    ]);
    setKycEvents((ev ?? []) as DbVerificationEvent[]);
    setKycUrls({
      id: idSigned.data?.signedUrl ?? null,
      selfie: vidSigned.data?.signedUrl ?? null,
    });
    setEventsBusy(false);
  }, []);

  const toggleKyc = useCallback(
    (row: VerRow) => {
      if (expandedKyc === row.id) {
        setExpandedKyc(null);
        return;
      }
      setExpandedKyc(row.id);
      void loadKycExtras(row);
    },
    [expandedKyc, loadKycExtras]
  );

  async function approveVer(id: string) {
    const { error } = await supabase
      .from('verification_requests')
      .update({
        status: 'admin_approved',
        reviewed_by: adminRecordId,
        rejection_reason: null,
      })
      .eq('id', id);
    if (error) Alert.alert('Approve failed', error.message);
    else Alert.alert('Approved', 'User will receive an in-app update.');
    setExpandedKyc(null);
    void load();
  }

  function openReject(id: string) {
    setRejectFor(id);
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectFor) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Reason required', 'Add a short explanation for the member.');
      return;
    }
    const { error } = await supabase
      .from('verification_requests')
      .update({
        status: 'admin_rejected',
        rejection_reason: reason,
        reviewed_by: adminRecordId,
      })
      .eq('id', rejectFor);
    if (error) Alert.alert('Reject failed', error.message);
    else Alert.alert('Rejected', 'User can resubmit from Verification.');
    setRejectFor(null);
    setRejectReason('');
    setExpandedKyc(null);
    void load();
  }

  async function resolveReport(id: string) {
    const { error } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', id);
    if (error) Alert.alert('Update failed', error.message);
    else {
      setReportDetail(null);
      void load();
    }
  }

  async function warnReportedUser(targetId: string) {
    const { error: nErr } = await supabase.rpc('admin_send_user_notice', {
      p_user_id: targetId,
      p_title: 'Account notice',
      p_body: 'We reviewed a report involving your account. Please follow our community guidelines. Repeated issues may lead to further action.',
      p_data: { href: '/(tabs)/profile' },
    });
    if (nErr) {
      Alert.alert('Notice failed', nErr.message);
      return;
    }
    const { error: uErr } = await supabase.from('users').update({ account_status: 'restricted' }).eq('id', targetId);
    if (uErr) Alert.alert('Status update failed', uErr.message);
    else Alert.alert('User warned', 'Restriction flag set; they received an in-app message.');
  }

  async function banReportedUser(targetId: string) {
    const { error: nErr } = await supabase.rpc('admin_send_user_notice', {
      p_user_id: targetId,
      p_title: 'Account suspended',
      p_body: 'Your account access has been suspended following a safety review. Contact support if you believe this is a mistake.',
      p_data: { href: '/support' },
    });
    if (nErr) {
      Alert.alert('Notice failed', nErr.message);
      return;
    }
    const { error: uErr } = await supabase.from('users').update({ account_status: 'suspended' }).eq('id', targetId);
    if (uErr) Alert.alert('Ban failed', uErr.message);
    else Alert.alert('User banned', 'Account marked suspended.');
  }

  const openReport = useCallback(async (r: DbReport) => {
    setReportDetail(r);
    setRelatedSnippet(null);
    if (!r.content_id) return;
    if (r.content_type === 'plan') {
      const { data } = await supabase.from('plans').select('title, description').eq('id', r.content_id).maybeSingle();
      if (data) {
        setRelatedSnippet(
          [data.title, data.description].filter(Boolean).join(' — ').slice(0, 500) || null
        );
      }
    } else if (r.content_type === 'message') {
      const { data } = await supabase
        .from('messages')
        .select('body, text')
        .eq('id', r.content_id)
        .maybeSingle();
      const blob = data?.body ?? data?.text;
      setRelatedSnippet(typeof blob === 'string' ? blob.slice(0, 500) : null);
    }
  }, []);

  const sortedReports = useMemo(() => {
    const order: Record<string, number> = { pending: 0, reviewed: 1, resolved: 2 };
    return [...reports].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }, [reports]);

  const filteredPlanDisputes = useMemo(() => {
    if (planDispFilter === 'all') return planDisputes;
    return planDisputes.filter((x) => x.status === 'pending' || x.status === 'reviewing');
  }, [planDisputes, planDispFilter]);

  const dashboardStats = useMemo(() => {
    const kycPending = ver.filter((x) => x.status === 'pending').length;
    const reportsPending = reports.filter((x) => x.status === 'pending').length;
    const disputesOpen = planDisputes.filter((x) => x.status === 'pending' || x.status === 'reviewing').length;
    const modHigh = mods.filter((x) => x.severity === 'high').length;
    const escrowOpen = disp.filter((x) => {
      const s = x.status.toLowerCase();
      return s === 'open' || s === 'under_review';
    }).length;
    const ticketsOpen = tickets.filter((x) => {
      const s = x.status.toLowerCase();
      return s === 'open' || s === 'in_progress';
    }).length;
    return { kycPending, reportsPending, disputesOpen, modHigh, escrowOpen, ticketsOpen };
  }, [ver, reports, planDisputes, mods, disp, tickets]);

  const sortedDisp = useMemo(() => {
    return [...disp].sort((a, b) => {
      const pa = a.queue_priority ?? 4;
      const pb = b.queue_priority ?? 4;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [disp]);

  const filteredTickets = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      const pa = a.queue_priority ?? 4;
      const pb = b.queue_priority ?? 4;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    if (ticketFilter === 'all') return sorted;
    return sorted.filter((x) => {
      const s = x.status.toLowerCase();
      return s === 'open' || s === 'in_progress';
    });
  }, [tickets, ticketFilter]);

  const openPlanDisputeDetail = useCallback(async (row: DbDispute) => {
    setPlanDispDetail(row);
    setPlanDispNotes(row.internal_notes ?? '');
    setPlanDispPartialPct('50');
    setPlanDispPartialOpen(false);
    setPlanDispEscrowCents(null);
    const [{ data: ev }, { data: esc }] = await Promise.all([
      supabase
        .from('dispute_evidence')
        .select('*')
        .eq('dispute_id', row.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('escrow_transactions')
        .select('amount_cents')
        .eq('plan_id', row.plan_id)
        .in('status', ['funded', 'disputed', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPlanDispEvidence((ev ?? []) as DbDisputeEvidence[]);
    if (esc?.amount_cents != null) setPlanDispEscrowCents(esc.amount_cents as number);
  }, []);

  async function savePlanDispReviewNotes() {
    if (!planDispDetail) return;
    setPlanDispBusy(true);
    const { error } = await supabase
      .from('disputes')
      .update({ internal_notes: planDispNotes.trim() || null, status: 'reviewing' })
      .eq('id', planDispDetail.id);
    setPlanDispBusy(false);
    if (error) Alert.alert('Save failed', error.message);
    else {
      Alert.alert('Saved', 'Notes and status updated.');
      void load();
      setPlanDispDetail(null);
    }
  }

  async function resolvePlanDisputeRow(
    status: 'resolved' | 'rejected',
    resolution: 'refund' | 'partial' | 'none' | null,
    partialBps?: number
  ) {
    if (!planDispDetail) return;
    setPlanDispBusy(true);
    const { error } = await supabase.rpc('admin_resolve_plan_dispute', {
      p_dispute_id: planDispDetail.id,
      p_new_status: status,
      p_resolution: status === 'resolved' ? resolution : 'none',
      p_internal_notes: planDispNotes.trim() || null,
      p_partial_bps: resolution === 'partial' ? (partialBps ?? null) : null,
    });
    if (error) {
      setPlanDispBusy(false);
      Alert.alert('Resolve failed', error.message);
      return;
    }

    if (
      status === 'resolved' &&
      planDispIssueGoodwill &&
      planDispGoodwillAmount.trim() &&
      resolution !== 'none'
    ) {
      const amountCents = Math.round(parseFloat(planDispGoodwillAmount) * 100);
      if (amountCents > 0) {
        const { error: gwErr } = await supabase.rpc('admin_issue_goodwill_credit', {
          p_user_id: planDispDetail.reporter_id,
          p_amount_cents: amountCents,
          p_source: 'dispute_resolution',
          p_admin_note: `Dispute resolution: ${planDispDetail.id}`,
          p_dispute_id: planDispDetail.id,
        });
        if (gwErr) Alert.alert('Goodwill issue failed', gwErr.message);
      }
    }

    setPlanDispBusy(false);
    setPlanDispDetail(null);
    setPlanDispPartialOpen(false);
    setPlanDispIssueGoodwill(false);
    setPlanDispGoodwillAmount('');
    void load();
  }

  if (!isAdmin) return <Redirect href="/(tabs)/profile" />;

  return (
    <Screen scroll={false} safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <View style={styles.root}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF5F8', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.28, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroRow}>
            <LinearGradient
              colors={[colors.primary, '#8B7CFF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="shield-checkmark" size={26} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Trust & safety</Text>
              <Text style={styles.heroTitle}>Admin</Text>
              <Text style={styles.heroSub}>
                Priority queues, audit trails, and resolution tools — keep the community confident.
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statVal}>{dashboardStats.kycPending}</Text>
              <Text style={styles.statLbl}>KYC pending</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statVal}>{dashboardStats.reportsPending}</Text>
              <Text style={styles.statLbl}>Reports</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statVal}>{dashboardStats.disputesOpen}</Text>
              <Text style={styles.statLbl}>Plan disputes</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarScroll}
            style={styles.tabBar}
            removeClippedSubviews={false}
          >
            <TabButton
              label="KYC"
              icon="id-card-outline"
              active={tab === 'verify'}
              onPress={() => setTab('verify')}
            />
            <TabButton
              label="Reports"
              icon="flag-outline"
              active={tab === 'reports'}
              onPress={() => setTab('reports')}
            />
            <TabButton
              label="Moderation"
              icon="flash-outline"
              active={tab === 'moderation'}
              onPress={() => setTab('moderation')}
            />
            <TabButton
              label="Disputes"
              icon="scale-outline"
              active={tab === 'plan_disputes'}
              onPress={() => setTab('plan_disputes')}
            />
            <TabButton
              label="Support"
              icon="chatbubbles-outline"
              active={tab === 'support'}
              onPress={() => setTab('support')}
            />
            <TabButton
              label="Users"
              icon="people-outline"
              active={tab === 'users'}
              onPress={() => setTab('users')}
            />
            <TabButton
              label="Plans"
              icon="albums-outline"
              active={tab === 'plans'}
              onPress={() => setTab('plans')}
            />
          </ScrollView>

          {loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} size="large" />
          ) : null}

          {tab === 'verify' ? (
            <>
              <SectionHeader
                title="Verification queue"
                subtitle="Tap a row for timeline, secure ID and liveness links (1 h expiry)."
                icon="finger-print-outline"
              />
              <FlatList
                data={ver}
                scrollEnabled={false}
                keyExtractor={(x) => x.id}
                renderItem={({ item }) => {
                  const st = kycStatusStyle(item.status);
                  const kycCanDecide = item.status === 'pending';
                  const prof = kycProfiles[item.user_id];
                  const displayName = prof?.display_name?.trim() || 'Member';
                  return (
                    <AdminListCard style={{ marginBottom: spacing.sm }}>
                      <Pressable onPress={() => void toggleKyc(item)}>
                        <View style={styles.cardTopRow}>
                          <View style={styles.kycIdentityRow}>
                            {prof?.avatar_url ? (
                              <Image source={{ uri: prof.avatar_url }} style={styles.kycAvatar} />
                            ) : (
                              <View style={styles.kycAvatarPlaceholder}>
                                <Ionicons name="person" size={20} color={colors.textMuted} />
                              </View>
                            )}
                            <View style={styles.kycIdentityText}>
                              <Text style={styles.kycCardName} numberOfLines={1}>
                                {displayName}
                              </Text>
                              <Text style={styles.kycCardUserId} numberOfLines={1} selectable>
                                {item.user_id}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.statusChip, { backgroundColor: st.bg, borderColor: st.border }]}>
                            <Text style={[styles.statusChipTxt, { color: st.fg }]}>{item.status}</Text>
                          </View>
                        </View>
                        <View style={styles.cardMetaRow}>
                          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.metaStrong}>{new Date(item.created_at).toLocaleString()}</Text>
                        </View>
                      </Pressable>
                      {expandedKyc === item.id ? (
                        <View style={styles.kycExpand}>
                          <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.kycExpandAccent}
                          />
                          {eventsBusy ? <ActivityIndicator color={colors.primary} style={styles.kycLoader} /> : null}

                          <Text style={styles.kycFieldLabel}>Member user ID</Text>
                          <Text style={styles.kycIdMono} selectable>
                            {item.user_id}
                          </Text>

                          <Text style={styles.kycFieldLabel}>Verification media</Text>
                          {kycUrls.id ? (
                            <Pressable
                              onPress={() => void Linking.openURL(kycUrls.id!)}
                              style={({ pressed }) => [styles.kycMediaCard, pressed && styles.kycMediaCardPressed]}
                            >
                              <LinearGradient
                                colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                pointerEvents="none"
                              />
                              <View style={styles.kycMediaRow}>
                                <View style={styles.kycMediaIconBg}>
                                  <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                                </View>
                                <View style={styles.kycMediaTextCol}>
                                  <Text style={styles.kycMediaTitle}>Government ID</Text>
                                  <Text style={styles.kycMediaCap}>Opens signed URL · expires in 1 hour</Text>
                                </View>
                                <Ionicons name="open-outline" size={22} color={colors.primary} />
                              </View>
                            </Pressable>
                          ) : (
                            <View style={styles.kycEmptyMedia}>
                              <Text style={styles.meta}>No ID file uploaded</Text>
                            </View>
                          )}
                          {kycUrls.selfie ? (
                            <Pressable
                              onPress={() => void Linking.openURL(kycUrls.selfie!)}
                              style={({ pressed }) => [styles.kycMediaCard, pressed && styles.kycMediaCardPressed]}
                            >
                              <LinearGradient
                                colors={['rgba(255,101,132,0.12)', 'rgba(108,99,255,0.1)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                pointerEvents="none"
                              />
                              <View style={styles.kycMediaRow}>
                                <View style={styles.kycMediaIconBg}>
                                  <Ionicons name="videocam-outline" size={22} color={colors.secondary} />
                                </View>
                                <View style={styles.kycMediaTextCol}>
                                  <Text style={styles.kycMediaTitle}>Liveness / selfie video</Text>
                                  <Text style={styles.kycMediaCap}>Opens signed URL · expires in 1 hour</Text>
                                </View>
                                <Ionicons name="open-outline" size={22} color={colors.secondary} />
                              </View>
                            </Pressable>
                          ) : (
                            <View style={styles.kycEmptyMedia}>
                              <Text style={styles.meta}>No selfie video uploaded</Text>
                            </View>
                          )}

                          <Text style={styles.subhead}>Audit timeline</Text>
                          {kycEvents.length === 0 ? (
                            <View style={styles.kycTimelineEmpty}>
                              <Ionicons name="git-commit-outline" size={22} color={colors.textMuted} />
                              <Text style={styles.kycTimelineEmptyTxt}>
                                No events logged yet — approvals and vendor webhooks will appear here.
                              </Text>
                            </View>
                          ) : (
                            kycEvents.map((e) => (
                              <View key={e.id} style={styles.timelineRow}>
                                <View style={styles.timelineDot} />
                                <Text style={styles.timelineLine}>
                                  {e.event_type} · {new Date(e.created_at).toLocaleString()}
                                </Text>
                              </View>
                            ))
                          )}

                          <View style={styles.kycActionRow}>
                            <Button
                              title={kycApproveButtonTitle(item.status, kycCanDecide)}
                              disabled={!kycCanDecide}
                              onPress={() => void approveVer(item.id)}
                              style={[
                                styles.kycActionBtn,
                                !kycCanDecide && styles.kycActionDisabled,
                                !kycCanDecide && { opacity: 1 },
                              ]}
                              textStyle={!kycCanDecide ? styles.kycActionDisabledTxt : undefined}
                            />
                            <Button
                              title="Reject"
                              variant="secondary"
                              disabled={!kycCanDecide}
                              onPress={() => openReject(item.id)}
                              style={[
                                styles.kycActionBtn,
                                !kycCanDecide && styles.kycActionDisabledSecondary,
                                !kycCanDecide && { opacity: 1 },
                              ]}
                              textStyle={!kycCanDecide ? styles.kycActionDisabledSecondaryTxt : undefined}
                            />
                          </View>
                        </View>
                      ) : null}
                    </AdminListCard>
                  );
                }}
              />
            </>
          ) : null}

          {tab === 'reports' ? (
            <>
              <SectionHeader
                title="Safety reports"
                subtitle="Member-reported issues — pending items sort first."
                icon="warning-outline"
              />
              <FlatList
                data={sortedReports}
                scrollEnabled={false}
                keyExtractor={(x) => x.id}
                renderItem={({ item }) => {
                  const st = reportStatusStyle(item.status);
                  return (
                    <Pressable onPress={() => void openReport(item)}>
                      <AdminListCard style={{ marginBottom: spacing.sm }}>
                        <Text style={styles.cardLead} numberOfLines={2}>
                          {item.reason}
                        </Text>
                        <View style={styles.cardTopRow}>
                          <View style={[styles.statusChip, { backgroundColor: st.bg, borderColor: st.border }]}>
                            <Text style={[styles.statusChipTxt, { color: st.fg }]}>{item.status}</Text>
                          </View>
                        </View>
                        <View style={styles.cardMetaRow}>
                          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.metaStrong}>
                            r {item.reporter_id.slice(0, 6)}… → {item.reported_user_id.slice(0, 6)}…
                          </Text>
                        </View>
                        <View style={styles.cardMetaRow}>
                          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                        </View>
                      </AdminListCard>
                    </Pressable>
                  );
                }}
              />
            </>
          ) : null}

          {tab === 'plan_disputes' ? (
            <>
              <SectionHeader
                title="Member plan disputes"
                subtitle="Evidence in private storage — open signed links in the browser; audit is chronological."
                icon="briefcase-outline"
              />
              <View style={styles.nestedTabs}>
                <TabButton label="Open" compact active={planDispFilter === 'open'} onPress={() => setPlanDispFilter('open')} />
                <TabButton label="All" compact active={planDispFilter === 'all'} onPress={() => setPlanDispFilter('all')} />
              </View>
              <FlatList
                data={filteredPlanDisputes}
                scrollEnabled={false}
                keyExtractor={(x) => x.id}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="checkmark-done-outline" size={36} color={colors.success} />
                    <Text style={styles.emptyTitle}>Queue clear</Text>
                    <Text style={styles.emptySub}>No rows match this filter.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable onPress={() => void openPlanDisputeDetail(item)}>
                    <AdminListCard style={{ marginBottom: spacing.sm }}>
                      <Text style={styles.cardLead}>{item.category.replace(/_/g, ' ')}</Text>
                      <View style={styles.cardTopRow}>
                        <View style={[styles.statusChip, styles.statusChipNeutral]}>
                          <Text style={styles.statusChipTxtNeutral}>{item.status}</Text>
                        </View>
                      </View>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.metaStrong}>Plan {item.plan_id.slice(0, 8)}…</Text>
                      </View>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                      </View>
                    </AdminListCard>
                  </Pressable>
                )}
              />

              <LinearGradient
                colors={['rgba(108,99,255,0.12)', 'transparent']}
                style={styles.sectionDivider}
              />
              <SectionHeader
                title="Escrow disputes"
                subtitle={`Legacy escrow queue — ${dashboardStats.escrowOpen} needing attention.`}
                icon="wallet-outline"
              />
              <FlatList
                data={sortedDisp}
                scrollEnabled={false}
                keyExtractor={(x) => x.id}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="wallet-outline" size={36} color={colors.success} />
                    <Text style={styles.emptyTitle}>No escrow rows</Text>
                    <Text style={styles.emptySub}>Nothing in this queue right now.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const stMeta = escrowDisputeStatusStyle(item.status);
                  const esc = item.escrow_row;
                  const amt = formatEscrowAmount(esc?.amount_cents, esc?.currency);
                  const canResolve =
                    item.status.toLowerCase() !== 'resolved' &&
                    item.status.toLowerCase() !== 'dismissed';
                  return (
                    <View style={styles.escrowCardWrap}>
                      <LinearGradient
                        colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.28)', 'rgba(52,211,153,0.25)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.escrowCardGradientPad}
                      >
                        <View style={styles.escrowCardFill}>
                          <View style={styles.escrowCardTop}>
                            <View style={styles.escrowCardTitleCol}>
                              <Text style={styles.escrowCardKicker}>Reason</Text>
                              <Text style={styles.escrowCardReason} numberOfLines={4}>
                                {item.reason}
                              </Text>
                            </View>
                            <View style={styles.escrowCardPillCol}>
                              {item.sla_deadline ? (
                                <SlaDeadlineBadge deadline={item.sla_deadline} />
                              ) : null}
                              <View
                                style={[
                                  styles.escrowStatusPill,
                                  { backgroundColor: stMeta.bg, borderColor: stMeta.border },
                                ]}
                              >
                                <Text style={[styles.escrowStatusPillTxt, { color: stMeta.fg }]}>
                                  {stMeta.label}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.escrowMetaGrid}>
                            <View style={styles.escrowMetaBlock}>
                              <View style={styles.escrowMetaBlockHead}>
                                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                                <Text style={styles.escrowMetaLbl}>Opened</Text>
                              </View>
                              <Text style={styles.escrowMetaVal}>
                                {new Date(item.created_at).toLocaleString()}
                              </Text>
                            </View>
                            {item.resolved_at ? (
                              <View style={styles.escrowMetaBlock}>
                                <View style={styles.escrowMetaBlockHead}>
                                  <Ionicons name="checkmark-done-outline" size={14} color={colors.success} />
                                  <Text style={styles.escrowMetaLbl}>Closed</Text>
                                </View>
                                <Text style={styles.escrowMetaVal}>
                                  {new Date(item.resolved_at).toLocaleString()}
                                </Text>
                              </View>
                            ) : null}
                            <View style={styles.escrowMetaBlock}>
                              <View style={styles.escrowMetaBlockHead}>
                                <Ionicons name="finger-print-outline" size={14} color={colors.textMuted} />
                                <Text style={styles.escrowMetaLbl}>Dispute ID</Text>
                              </View>
                              <Text style={styles.escrowMetaValMono} selectable>
                                {item.id}
                              </Text>
                            </View>
                            {esc ? (
                              <>
                                <View style={styles.escrowMetaBlock}>
                                  <View style={styles.escrowMetaBlockHead}>
                                    <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                                    <Text style={styles.escrowMetaLbl}>Escrow</Text>
                                  </View>
                                  <Text style={styles.escrowMetaValMono}>{shortUuid(esc.id, 12)}</Text>
                                </View>
                                <View style={styles.escrowMetaBlock}>
                                  <View style={styles.escrowMetaBlockHead}>
                                    <Ionicons name="albums-outline" size={14} color={colors.textMuted} />
                                    <Text style={styles.escrowMetaLbl}>Plan</Text>
                                  </View>
                                  <Text style={styles.escrowMetaValMono}>{shortUuid(esc.plan_id, 12)}</Text>
                                </View>
                                {amt ? (
                                  <View style={styles.escrowMetaBlock}>
                                    <View style={styles.escrowMetaBlockHead}>
                                      <Ionicons name="cash-outline" size={14} color={colors.primary} />
                                      <Text style={styles.escrowMetaLbl}>Held amount</Text>
                                    </View>
                                    <Text style={styles.escrowMetaValStrong}>{amt}</Text>
                                  </View>
                                ) : null}
                                <View style={styles.escrowMetaBlock}>
                                  <View style={styles.escrowMetaBlockHead}>
                                    <Ionicons name="pulse-outline" size={14} color={colors.textMuted} />
                                    <Text style={styles.escrowMetaLbl}>Escrow status</Text>
                                  </View>
                                  <Text style={styles.escrowMetaVal}>{esc.status.replace(/_/g, ' ')}</Text>
                                </View>
                              </>
                            ) : null}
                            {item.opened_by ? (
                              <View style={styles.escrowMetaBlock}>
                                <View style={styles.escrowMetaBlockHead}>
                                  <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                                  <Text style={styles.escrowMetaLbl}>Raised by</Text>
                                </View>
                                <Text style={styles.escrowMetaValMono}>{shortUuid(item.opened_by, 12)}</Text>
                              </View>
                            ) : null}
                          </View>

                          {item.detail ? (
                            <View style={styles.escrowDetailBox}>
                              <Text style={styles.escrowDetailKicker}>Member detail</Text>
                              <Text style={styles.escrowDetailTxt} numberOfLines={4}>
                                {item.detail}
                              </Text>
                            </View>
                          ) : null}

                          {item.admin_resolution ? (
                            <View style={styles.escrowResolutionNote}>
                              <Text style={styles.escrowResolutionKicker}>Resolution note</Text>
                              <Text style={styles.escrowResolutionBody}>{item.admin_resolution}</Text>
                            </View>
                          ) : null}

                          {item.support_ticket_id ? (
                            <View style={styles.escrowLinkedTicket}>
                              <Ionicons name="link-outline" size={14} color={colors.primary} />
                              <Text style={styles.escrowLinkedTicketTxt}>
                                Linked support ticket · {shortUuid(item.support_ticket_id, 10)}
                              </Text>
                            </View>
                          ) : null}

                          {canResolve ? (
                            <Button
                              title="Resolve dispute"
                              variant="ghost"
                              fullWidth
                              onPress={() => {
                                if (!esc?.id) {
                                  Alert.alert('Escrow missing', 'Could not load escrow row for this dispute.');
                                  return;
                                }
                                setEscrowResolveCtx({
                                  disputeId: item.id,
                                  escrowId: esc.id,
                                  amountCents: esc.amount_cents,
                                  currency: esc.currency,
                                  payerId: esc.payer_id,
                                  payeeId: esc.payee_id,
                                  payerLabel: shortUuid(esc.payer_id, 10),
                                  payeeLabel: shortUuid(esc.payee_id, 10),
                                });
                              }}
                              style={styles.escrowResolveBtn}
                            />
                          ) : (
                            <View style={styles.escrowClosedFoot}>
                              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                              <Text style={styles.escrowClosedFootTxt}>
                                Closed — no further action available from this list.
                              </Text>
                            </View>
                          )}
                        </View>
                      </LinearGradient>
                    </View>
                  );
                }}
              />
            </>
          ) : null}

          {tab === 'support' ? (
            <>
              <SectionHeader
                title="Support inbox"
                subtitle={`${dashboardStats.ticketsOpen} open or in progress · showing ${filteredTickets.length} ticket${filteredTickets.length === 1 ? '' : 's'}.`}
                icon="chatbubbles-outline"
              />
              <View style={styles.nestedTabs}>
                <TabButton
                  label="Open"
                  compact
                  active={ticketFilter === 'open'}
                  onPress={() => setTicketFilter('open')}
                />
                <TabButton
                  label="All"
                  compact
                  active={ticketFilter === 'all'}
                  onPress={() => setTicketFilter('all')}
                />
              </View>
              <FlatList
                data={filteredTickets}
                scrollEnabled={false}
                keyExtractor={(x) => x.id}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={36} color={colors.success} />
                    <Text style={styles.emptyTitle}>Inbox clear</Text>
                    <Text style={styles.emptySub}>No tickets match this filter.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const tst = ticketStatusStyle(item.status);
                  const preview =
                    item.body?.trim().slice(0, 200) || 'No message body on file.';
                  return (
                    <Pressable onPress={() => setTicketDetail(item)}>
                      <AdminListCard style={{ marginBottom: spacing.sm }}>
                        <View style={styles.supportCardTop}>
                          <Text style={styles.supportCardSubject} numberOfLines={2}>
                            {item.subject || '(No subject)'}
                          </Text>
                          <View style={styles.supportCardPillCol}>
                            {item.is_concierge ? (
                              <View style={styles.conciergeChip}>
                                <TierBadge tier="PLATINUM" compact />
                                <Text style={styles.conciergeChipTxt}>Concierge</Text>
                              </View>
                            ) : null}
                            {item.sla_deadline ? (
                              <SlaDeadlineBadge deadline={item.sla_deadline} />
                            ) : null}
                            <View
                              style={[
                                styles.ticketStatusPill,
                                { backgroundColor: tst.bg, borderColor: tst.border },
                              ]}
                            >
                              <Text style={[styles.ticketStatusPillTxt, { color: tst.fg }]}>
                                {item.status.replace(/_/g, ' ')}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.supportCardMetaRow}>
                          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.supportMetaTxt}>
                            {new Date(item.created_at).toLocaleString()}
                          </Text>
                          <Text style={styles.supportMetaDot}>·</Text>
                          <Text style={styles.supportMetaTxt}>Priority {item.priority}</Text>
                        </View>
                        <View style={styles.supportCardMetaRow}>
                          <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.supportMetaTxtMono} selectable>
                            {item.user_id}
                          </Text>
                        </View>
                        <Text style={styles.supportBodyPreview} numberOfLines={3}>
                          {preview}
                          {item.body && item.body.trim().length > 200 ? '…' : ''}
                        </Text>
                        <View style={styles.supportTapHint}>
                          <Text style={styles.supportTapHintTxt}>Open full ticket</Text>
                          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                        </View>
                      </AdminListCard>
                    </Pressable>
                  );
                }}
              />
            </>
          ) : null}

          {tab === 'users' ? (
            <>
              <SectionHeader
                title="Member directory"
                subtitle="Account health, verification, and profile cards — pair with KYC for identity."
                icon="people-outline"
              />
              <AdminUsersPanel />
            </>
          ) : null}

          {tab === 'plans' ? (
            <>
              <SectionHeader
                title="Plans directory"
                subtitle="Mood TTL, suppression, and deep links — pair with Reports for context."
                icon="albums-outline"
              />
              <AdminPlansPanel />
            </>
          ) : null}

          {tab === 'moderation' ? (
            <>
              <SectionHeader
                title="Moderation log"
                subtitle="Pipeline: moderation-check scores text, may hide content, and notifies admins on high severity. Rows sorted with high first."
                icon="analytics-outline"
              />
              <FlatList
                data={mods}
                scrollEnabled={false}
                keyExtractor={(x) => x.id}
                renderItem={({ item }) => {
                  const sev = severityStyle(item.severity);
                  const author = modProfiles[item.user_id];
                  const authorName = author?.display_name?.trim() || 'Unknown member';
                  const flagLbl = moderationFlagLabel(item.flag_type);
                  return (
                    <AdminListCard style={{ marginBottom: spacing.sm }}>
                      <View style={styles.modCardTop}>
                        <View style={[styles.sevTag, { backgroundColor: sev.bg }]}>
                          <Text style={[styles.sevTagTxt, { color: sev.fg }]}>{item.severity.toUpperCase()}</Text>
                        </View>
                        <View style={styles.modFlagChip}>
                          <Text style={styles.modFlagChipTxt}>{flagLbl}</Text>
                        </View>
                      </View>

                      <Text style={styles.modSummary}>{moderationAuditSummary(item)}</Text>

                      <View style={styles.modContentPanel}>
                        <View style={styles.modContentHead}>
                          <Ionicons name={moderationContentIcon(item.content_type)} size={20} color={colors.primary} />
                          <Text style={styles.modContentHeadTxt}>{moderationContentLabel(item.content_type)}</Text>
                        </View>
                        {item.content_type === 'message' ? (
                          modMessagePreview[item.content_id] ? (
                            <Text style={styles.modQuote} numberOfLines={8}>
                              “{modMessagePreview[item.content_id]}
                              {modMessagePreview[item.content_id].length >= 320 ? '…' : ''}”
                            </Text>
                          ) : (
                            <Text style={styles.modPreviewMuted}>
                              Message body not loaded (deleted, RLS, or non-text). Use content id below to trace in DB.
                            </Text>
                          )
                        ) : item.content_type === 'plan' ? (
                          modPlanTitle[item.content_id] ? (
                            <Text style={styles.modPlanTitlePreview}>{modPlanTitle[item.content_id]}</Text>
                          ) : (
                            <Text style={styles.modPreviewMuted}>
                              Plan title not found (draft removed or RLS). Content id is the plan UUID.
                            </Text>
                          )
                        ) : (
                          <Text style={styles.modPreviewMuted}>
                            Profile save: moderated fields include display name, bio, and prompt answers. For profiles, content
                            id is usually the member&apos;s user id.
                          </Text>
                        )}
                      </View>

                      <View style={styles.modActorCard}>
                        {author?.avatar_url ? (
                          <Image source={{ uri: author.avatar_url }} style={styles.modActorAvatar} contentFit="cover" />
                        ) : (
                          <View style={styles.modActorAvatarPh}>
                            <Ionicons name="person-outline" size={22} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.modActorMeta}>
                          <Text style={styles.modActorName} numberOfLines={1}>
                            {authorName}
                          </Text>
                          <Text style={styles.modDetailLbl}>Sender / author (user_id)</Text>
                          <Text style={styles.modMonoSm} selectable>
                            {item.user_id}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modStatRow}>
                        <View style={styles.modStatCell}>
                          <Text style={styles.modDetailLbl}>System action</Text>
                          <Text style={styles.modStatVal}>{moderationActionLabel(item.action_taken)}</Text>
                        </View>
                        <View style={styles.modStatCell}>
                          <Text style={styles.modDetailLbl}>Heuristic score</Text>
                          <Text style={styles.modStatVal}>{formatModerationScore(item.ai_score)}</Text>
                        </View>
                      </View>

                      <View style={styles.modIdsBox}>
                        <Text style={styles.modDetailLbl}>Audit ids (select to copy)</Text>
                        <Text style={styles.modMonoXs} selectable>
                          Log: {item.id}
                        </Text>
                        <Text style={styles.modMonoXs} selectable>
                          Content: {item.content_id}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() =>
                          void Clipboard.setStringAsync(
                            `moderation_log_id=${item.id}\ncontent_id=${item.content_id}\nuser_id=${item.user_id}`
                          )
                        }
                        style={({ pressed }) => [styles.modCopyBtn, pressed && styles.tabBtnPressed]}
                      >
                        <Ionicons name="copy-outline" size={18} color={colors.primary} />
                        <Text style={styles.modCopyBtnTxt}>Copy log, content, and user ids</Text>
                      </Pressable>

                      <View style={styles.cardMetaRow}>
                        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                      </View>
                    </AdminListCard>
                  );
                }}
              />
            </>
          ) : null}

          <Pressable
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Refresh all admin data"
            style={({ pressed }) => [styles.refreshOuter, pressed && styles.refreshPressed]}
          >
            <LinearGradient
              colors={[colors.primary, '#8B7CE8', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.refreshGrad}
            >
              <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
              <Text style={styles.refreshLabel}>Refresh all data</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>

      <Modal visible={planDispDetail !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalAccent}
              />
              <Text style={styles.modalTitle}>Plan dispute</Text>
              {planDispDetail ? (
                <>
                  <Text style={styles.meta}>Status: {planDispDetail.status}</Text>
                  <Text style={styles.meta}>Category: {planDispDetail.category}</Text>
                  <Text style={styles.meta}>Plan: {planDispDetail.plan_id}</Text>
                  <Text style={styles.meta}>
                    Parties: {planDispDetail.reporter_id.slice(0, 8)}… →{' '}
                    {planDispDetail.reported_user_id.slice(0, 8)}…
                  </Text>
                  {planDispDetail.reporter_note ? (
                    <Text style={styles.t}>Member note: {planDispDetail.reporter_note}</Text>
                  ) : null}
                  <Text style={styles.subhead}>Internal notes</Text>
                  <TextInput
                    value={planDispNotes}
                    onChangeText={setPlanDispNotes}
                    placeholder="Visible to admins only"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={styles.input}
                  />
                  <Button
                    title="Save notes & mark reviewing"
                    variant="secondary"
                    loading={planDispBusy}
                    fullWidth
                    onPress={() => void savePlanDispReviewNotes()}
                  />
                  <Text style={[styles.subhead, { marginTop: spacing.md }]}>Evidence timeline</Text>
                  {planDispEvidence.map((ev) => (
                    <Card key={ev.id} style={{ marginBottom: spacing.sm }}>
                      <Text style={styles.t}>
                        {ev.type} · {new Date(ev.created_at).toLocaleString()}
                      </Text>
                      {ev.type === 'text' ? (
                        <Text style={styles.bodySnippet}>{ev.text_body}</Text>
                      ) : ev.file_path ? (
                        <Text
                          style={styles.link}
                          onPress={() =>
                            void (async () => {
                              const { data, error } = await supabase.storage
                                .from('private_disputes')
                                .createSignedUrl(ev.file_path!, 3600);
                              if (error || !data?.signedUrl) {
                                Alert.alert('URL failed', error?.message ?? 'No link');
                                return;
                              }
                              Linking.openURL(data.signedUrl);
                            })()
                          }
                        >
                          Open signed file (1h)
                        </Text>
                      ) : null}
                    </Card>
                  ))}
                  <View style={styles.modalBtnCol}>
                    <Button fullWidth title="Close" variant="ghost" onPress={() => setPlanDispDetail(null)} />
                  </View>
                  <Text style={styles.subhead}>Resolve</Text>
                  <View style={styles.goodwillOptionRow}>
                    <Switch value={planDispIssueGoodwill} onValueChange={setPlanDispIssueGoodwill} />
                    <Text style={styles.goodwillOptionLabel}>Also issue goodwill credit to reporter</Text>
                  </View>
                  {planDispIssueGoodwill ? (
                    <TextInput
                      style={styles.input}
                      placeholder="Goodwill amount (NGN)"
                      keyboardType="decimal-pad"
                      value={planDispGoodwillAmount}
                      onChangeText={setPlanDispGoodwillAmount}
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : null}
                  <View style={styles.modalBtnCol}>
                    <Button
                      fullWidth
                      title="Reject claim"
                      variant="secondary"
                      loading={planDispBusy}
                      onPress={() =>
                        Alert.alert('Reject claim?', 'This closes the dispute without a payout action.', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Reject',
                            style: 'destructive',
                            onPress: () => void resolvePlanDisputeRow('rejected', null),
                          },
                        ])
                      }
                    />
                    <Button
                      fullWidth
                      title="Resolve · full refund"
                      loading={planDispBusy}
                      onPress={() => void resolvePlanDisputeRow('resolved', 'refund')}
                    />
                    <Button
                      fullWidth
                      title="Resolve · partial refund"
                      loading={planDispBusy}
                      variant="secondary"
                      onPress={() => setPlanDispPartialOpen((v) => !v)}
                    />
                    {planDispPartialOpen ? (
                      <View style={styles.planPartialBox}>
                        <Text style={styles.planPartialLbl}>Guest receives (% of net)</Text>
                        <View style={styles.planPartialRow}>
                          <TextInput
                            style={styles.planPartialInput}
                            keyboardType="numeric"
                            value={planDispPartialPct}
                            onChangeText={setPlanDispPartialPct}
                            maxLength={3}
                            placeholder="50"
                            placeholderTextColor={colors.textMuted}
                          />
                          <Text style={styles.planPartialPct}>%</Text>
                        </View>
                        {planDispEscrowCents != null ? (
                          <Text style={styles.planPartialHint}>
                            Guest ~₦
                            {Math.round(
                              ((planDispEscrowCents * 0.94 * parseInt(planDispPartialPct || '0', 10)) / 100) /
                                100
                            ).toLocaleString()}{' '}
                            · Host ~₦
                            {Math.round(
                              ((planDispEscrowCents * 0.94 * (100 - parseInt(planDispPartialPct || '0', 10))) /
                                100) /
                                100
                            ).toLocaleString()}{' '}
                            (est. net)
                          </Text>
                        ) : null}
                        <Button
                          fullWidth
                          title="Confirm partial resolution"
                          loading={planDispBusy}
                          onPress={() => {
                            const pct = parseInt(planDispPartialPct, 10);
                            if (Number.isNaN(pct) || pct < 0 || pct > 100) {
                              Alert.alert('Partial', 'Enter a percentage between 0 and 100.');
                              return;
                            }
                            Alert.alert(
                              'Apply partial refund?',
                              `Guest receives ${pct}% of net escrow.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Confirm',
                                  onPress: () =>
                                    void resolvePlanDisputeRow('resolved', 'partial', pct * 100),
                                },
                              ]
                            );
                          }}
                        />
                      </View>
                    ) : null}
                    <Button
                      fullWidth
                      title="Resolve · no payout"
                      loading={planDispBusy}
                      variant="secondary"
                      onPress={() => void resolvePlanDisputeRow('resolved', 'none')}
                    />
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <AdminSupportTicketModal
        ticket={ticketDetail}
        onClose={() => setTicketDetail(null)}
        onUpdated={() => void load()}
      />

      <EscrowDisputeResolveModal
        context={escrowResolveCtx}
        onClose={() => setEscrowResolveCtx(null)}
        onResolved={() => void load()}
      />

      <Modal visible={rejectFor !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={[colors.secondary, '#FF9AAC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalAccent}
            />
            <Text style={styles.modalTitle}>Rejection reason</Text>
            <Text style={styles.hint}>Required — this text is shared with the member.</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Explain what to fix or resubmit"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
            <View style={styles.modalBtnCol}>
              <Button title="Cancel" variant="ghost" onPress={() => setRejectFor(null)} fullWidth />
              <Button title="Reject" variant="secondary" onPress={() => void confirmReject()} fullWidth />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reportDetail !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <LinearGradient
                colors={['#6366F1', colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalAccent}
              />
              <Text style={styles.modalTitle}>Report detail</Text>
              {reportDetail ? (
                <>
                  <Text style={styles.meta}>Reason: {reportDetail.reason}</Text>
                  <Text style={styles.meta}>Status: {reportDetail.status}</Text>
                  <Text style={styles.meta}>Content: {reportDetail.content_type}</Text>
                  {reportDetail.note ? <Text style={styles.t}>Note: {reportDetail.note}</Text> : null}
                  {relatedSnippet ? (
                    <Card style={{ marginTop: spacing.sm }}>
                      <Text style={styles.subhead}>Related content</Text>
                      <Text style={styles.bodySnippet}>{relatedSnippet}</Text>
                    </Card>
                  ) : null}
                  <View style={styles.modalBtnCol}>
                    <Button fullWidth title="Close" variant="ghost" onPress={() => setReportDetail(null)} />
                    <Button
                      fullWidth
                      title="Mark resolved"
                      onPress={() => reportDetail && void resolveReport(reportDetail.id)}
                    />
                    <Button
                      fullWidth
                      title="Warn reported user"
                      variant="secondary"
                      onPress={() => reportDetail && void warnReportedUser(reportDetail.reported_user_id)}
                    />
                    <Button
                      fullWidth
                      title="Suspend reported user"
                      variant="secondary"
                      onPress={() =>
                        reportDetail &&
                        Alert.alert('Ban user?', 'This suspends their account.', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Ban',
                            style: 'destructive',
                            onPress: () => void banReportedUser(reportDetail.reported_user_id),
                          },
                        ])
                      }
                    />
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
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
  heroText: { flex: 1 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.6 },
  heroSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  statPill: {
    minWidth: '22%',
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    alignItems: 'center',
  },
  statVal: { fontSize: 20, fontWeight: '900', color: colors.primary },
  statValAlert: { color: colors.danger },
  statValWarn: { color: colors.warning },
  statLbl: { fontSize: 10, fontWeight: '800', color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  tabBar: { marginBottom: spacing.md },
  tabBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: spacing.md,
    paddingVertical: 6,
  },
  tabBtnOuter: {
    minWidth: 118,
    flexShrink: 0,
    borderRadius: radius.button,
  },
  tabBtnOuterCompact: { minWidth: 92 },
  tabBtnOuterActive:
    Platform.OS === 'ios'
      ? {
          shadowColor: '#4c1d95',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.28,
          shadowRadius: 6,
        }
      : {
          // Android: never put elevation / legacy shadow on a transparent wrapper above
          // overflow:hidden + LinearGradient — it routinely produces a blurred “blob” that
          // covers icon + label after the view hierarchy updates (tab switch).
          elevation: 0,
        },
  tabBtnClip: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  /** Active tab edge definition on Android (replaces iOS-only drop shadow). */
  tabBtnClipActiveAndroid: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  tabBtnClipCompact: { minHeight: 40 },
  tabBtnIdle: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.28)',
  },
  tabBtnPressed: { opacity: 0.94 },
  tabBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    position: 'relative',
    zIndex: 1,
  },
  tabBtnTxt: {
    fontWeight: '800',
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 0,
  },
  tabBtnTxtOn: {
    color: '#fff',
    ...(Platform.OS === 'ios'
      ? {
          textShadowColor: 'rgba(0,0,0,0.22)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }
      : {}),
  },
  tabBtnTxtCompact: { fontSize: 13 },
  loader: { marginVertical: spacing.lg },
  sectionHeaderBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionIconRing: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconInner: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  sectionDivider: { height: 2, marginVertical: spacing.lg, borderRadius: 2, opacity: 0.9 },
  adminCard: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  adminCardStripe: { width: 4 },
  adminCardBody: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardLead: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2, marginBottom: 6 },
  cardUserHint: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaStrong: { color: colors.text, fontSize: 13, fontWeight: '700' },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusChipTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  statusChipNeutral: {
    backgroundColor: 'rgba(107,114,128,0.1)',
    borderColor: colors.border,
  },
  statusChipTxtNeutral: { fontSize: 11, fontWeight: '900', color: colors.textMuted },
  sevTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.button },
  sevTagTxt: { fontSize: 11, fontWeight: '900' },
  nestedTabs: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm, flexWrap: 'wrap' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginTop: spacing.sm },
  emptySub: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  refreshOuter: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    overflow: 'hidden',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#6C63FF',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 14,
        }
      : { elevation: 5 }),
  },
  refreshPressed: { opacity: 0.94, transform: [{ scale: 0.98 }] },
  refreshGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  refreshLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: spacing.sm, flexWrap: 'wrap' },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  t: { fontWeight: '600', color: colors.text },
  kycExpand: { marginTop: spacing.md, gap: 0 },
  kycExpandAccent: {
    height: 3,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  kycLoader: { marginVertical: spacing.sm },
  kycFieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  kycIdMono: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  kycMediaCard: {
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    minHeight: 72,
    justifyContent: 'center',
  },
  kycMediaCardPressed: { opacity: 0.92 },
  kycMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  kycMediaIconBg: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
  },
  kycMediaTextCol: { flex: 1, minWidth: 0 },
  kycMediaTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  kycMediaCap: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  kycEmptyMedia: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(107,114,128,0.08)',
    marginBottom: spacing.sm,
  },
  kycTimelineEmpty: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108,99,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
    marginBottom: spacing.sm,
  },
  kycTimelineEmptyTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 20 },
  kycActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  kycActionBtn: {
    flex: 1,
    minWidth: 0,
  },
  kycActionDisabled: {
    backgroundColor: '#E2E8F0',
  },
  kycActionDisabledTxt: {
    color: '#64748B',
    fontWeight: '700',
  },
  kycActionDisabledSecondary: {
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  kycActionDisabledSecondaryTxt: {
    color: '#64748B',
    fontWeight: '700',
  },
  modalBtnCol: { gap: spacing.sm, marginTop: spacing.sm },
  goodwillOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  goodwillOptionLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  planPartialBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    backgroundColor: 'rgba(108, 99, 255, 0.05)',
    gap: spacing.sm,
  },
  planPartialLbl: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  planPartialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planPartialInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  planPartialPct: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
  },
  planPartialHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 19,
  },
  link: { color: colors.primary, fontWeight: '700', marginTop: 0, flex: 1 },
  subhead: { fontWeight: '800', marginTop: spacing.sm, color: colors.text, fontSize: 14 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  timelineLine: { fontSize: 13, color: colors.textMuted, flex: 1, lineHeight: 18 },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    overflow: 'hidden',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  modalAccent: {
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: spacing.sm, letterSpacing: -0.3 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.md,
    minHeight: 88,
    padding: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    color: colors.text,
    textAlignVertical: 'top',
  },
  bodySnippet: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  kycIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  kycAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  kycAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(108,99,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
  },
  kycIdentityText: { flex: 1, minWidth: 0 },
  kycCardName: { fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  kycCardUserId: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  escrowCardWrap: { marginBottom: spacing.md },
  escrowCardGradientPad: {
    borderRadius: radius.lg + 1,
    padding: 1.5,
    overflow: 'hidden',
  },
  escrowCardFill: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  escrowCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  escrowCardPillCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  escrowCardTitleCol: { flex: 1, minWidth: 0 },
  escrowCardKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  escrowCardReason: { fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 22 },
  escrowStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    borderWidth: 1,
    flexShrink: 0,
  },
  escrowStatusPillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  escrowMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  escrowMetaBlock: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    backgroundColor: 'rgba(108,99,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.1)',
  },
  escrowMetaBlockHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  escrowMetaLbl: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  escrowMetaVal: { fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 18 },
  escrowMetaValMono: { fontSize: 12, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  escrowMetaValStrong: { fontSize: 16, fontWeight: '900', color: colors.primary },
  escrowDetailBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  escrowDetailKicker: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginBottom: 4 },
  escrowDetailTxt: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  escrowResolutionNote: {
    backgroundColor: '#F0FDF4',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    marginBottom: spacing.sm,
  },
  escrowResolutionKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  escrowResolutionBody: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  escrowLinkedTicket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
    paddingVertical: 6,
  },
  escrowLinkedTicketTxt: { fontSize: 13, fontWeight: '700', color: colors.primary, flex: 1 },
  escrowResolveBtn: {
    marginTop: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.35)',
    backgroundColor: 'rgba(108,99,255,0.06)',
  },
  escrowClosedFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(107,114,128,0.08)',
  },
  escrowClosedFootTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  supportCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  supportCardPillCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  conciergeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(124, 77, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(94, 53, 177, 0.28)',
  },
  conciergeChipTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: '#5E35B1',
    letterSpacing: 0.3,
  },
  supportCardSubject: { flex: 1, fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  ticketStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    borderWidth: 1,
    flexShrink: 0,
  },
  ticketStatusPillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.15 },
  supportCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  supportMetaTxt: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  supportMetaDot: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  supportMetaTxtMono: { fontSize: 11, fontWeight: '700', color: colors.text, flex: 1 },
  supportBodyPreview: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  supportTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  supportTapHintTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  modCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  modFlagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.22)',
  },
  modFlagChipTxt: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.2 },
  modSummary: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modContentPanel: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(26,29,38,0.08)',
    marginBottom: spacing.md,
  },
  modContentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  modContentHeadTxt: { fontSize: 15, fontWeight: '800', color: colors.text },
  modQuote: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  modPlanTitlePreview: { fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 21 },
  modPreviewMuted: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19 },
  modActorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108,99,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
  },
  modActorAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface },
  modActorAvatarPh: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modActorMeta: { flex: 1, minWidth: 0 },
  modActorName: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 4 },
  modDetailLbl: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    marginBottom: 2,
  },
  modMonoSm: { fontSize: 11, fontWeight: '700', color: colors.text, lineHeight: 16 },
  modMonoXs: { fontSize: 10, fontWeight: '600', color: colors.text, lineHeight: 15, fontVariant: ['tabular-nums'] },
  modStatRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  modStatCell: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modStatVal: { fontSize: 14, fontWeight: '800', color: colors.text, lineHeight: 19 },
  modIdsBox: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(26,29,38,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(26,29,38,0.06)',
  },
  modCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
    backgroundColor: 'rgba(108,99,255,0.06)',
    marginBottom: spacing.sm,
  },
  modCopyBtnTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
