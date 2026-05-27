/**
 * Support ticket detail — app-standard detail modal (admin).
 */
import { AppDetailModal } from '@/components/ui/AppDetailModal';
import { AppFeedbackModal } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing } from '@/constants/theme';
import type { DbSupportTicket } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

function ticketStatusStyle(status: string): { bg: string; fg: string; border: string } {
  const s = status.toLowerCase();
  if (s === 'open') return { bg: 'rgba(245,158,11,0.16)', fg: '#B45309', border: 'rgba(245,158,11,0.35)' };
  if (s === 'in_progress') return { bg: 'rgba(108,99,255,0.14)', fg: colors.primary, border: 'rgba(108,99,255,0.35)' };
  if (s === 'resolved') return { bg: 'rgba(16,185,129,0.14)', fg: '#047857', border: 'rgba(16,185,129,0.3)' };
  return { bg: 'rgba(107,114,128,0.1)', fg: colors.textMuted, border: colors.border };
}

function priorityStyle(priority: string): { bg: string; fg: string; border: string } {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'urgent') {
    return { bg: 'rgba(239,68,68,0.12)', fg: colors.danger, border: 'rgba(239,68,68,0.3)' };
  }
  if (p === 'low') {
    return { bg: 'rgba(107,114,128,0.1)', fg: colors.textMuted, border: colors.border };
  }
  return { bg: 'rgba(108,99,255,0.1)', fg: colors.primary, border: 'rgba(108,99,255,0.25)' };
}

function shortUuid(id: string, len = 8): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type Props = {
  ticket: DbSupportTicket | null;
  onClose: () => void;
};

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionDot} />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export function AdminSupportTicketModal({ ticket, onClose }: Props) {
  const visible = ticket != null;
  const [copyFeedbackOpen, setCopyFeedbackOpen] = useState(false);

  async function copyMemberId() {
    if (!ticket?.user_id) return;
    await Clipboard.setStringAsync(ticket.user_id);
    setCopyFeedbackOpen(true);
  }

  const status = ticket ? ticketStatusStyle(ticket.status) : null;
  const priority = ticket ? priorityStyle(ticket.priority) : null;
  const body = ticket?.body?.trim() || '';

  return (
    <>
    <AppDetailModal
      visible={visible}
      onClose={onClose}
      kicker="Admin"
      title="Support ticket"
      icon="chatbubbles-outline"
      iconGrad={['#0EA5E9', colors.primary]}
      primaryLabel="Close"
      contentContainerStyle={styles.scrollContent}
    >
      {ticket ? (
        <>
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: status!.bg, borderColor: status!.border }]}>
              <Text style={[styles.pillTxt, { color: status!.fg }]}>
                {ticket.status.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: priority!.bg, borderColor: priority!.border }]}>
              <Text style={[styles.pillTxt, { color: priority!.fg }]}>{ticket.priority}</Text>
            </View>
          </View>

          <LinearGradient
            colors={['rgba(108,99,255,0.16)', 'rgba(255,101,132,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.subjectOuter}
          >
            <View style={styles.subjectInner}>
              <Text style={styles.subjectLabel}>Subject</Text>
              <Text style={styles.subjectText}>{ticket.subject?.trim() || '(No subject)'}</Text>
            </View>
          </LinearGradient>

          <DetailSection label="Message">
            <View style={styles.messageBox}>
              <Text style={body ? styles.messageText : styles.messageEmpty}>
                {body || 'No message body on file.'}
              </Text>
            </View>
          </DetailSection>

          <DetailSection label="Member">
            <View style={styles.memberRow}>
              <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.memberShort} selectable>
                {shortUuid(ticket.user_id, 12)}
              </Text>
              <Pressable
                onPress={() => void copyMemberId()}
                style={({ pressed }) => [styles.copyBtn, pressed && styles.copyPressed]}
                accessibilityRole="button"
                accessibilityLabel="Copy member ID"
              >
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
                <Text style={styles.copyBtnTxt}>Copy ID</Text>
              </Pressable>
            </View>
          </DetailSection>

          <View style={styles.metaCell}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <View style={styles.metaTextCol}>
              <Text style={styles.metaLbl}>Created</Text>
              <Text style={styles.metaVal}>{formatWhen(ticket.created_at)}</Text>
            </View>
          </View>
        </>
      ) : null}
    </AppDetailModal>

    <AppFeedbackModal
      visible={copyFeedbackOpen}
      onClose={() => setCopyFeedbackOpen(false)}
      variant="success"
      kicker="Admin"
      title="Copied"
      message="Member ID copied to clipboard."
      primaryLabel="Got it"
    />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  subjectOuter: {
    borderRadius: radius.lg,
    padding: 2,
    alignSelf: 'stretch',
  },
  subjectInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg - 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  subjectLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  subjectText: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    lineHeight: 24,
    letterSpacing: -0.25,
  },
  section: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  messageBox: {
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    minHeight: 72,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 23,
  },
  messageEmpty: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 23,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  memberShort: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }),
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.28)',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  copyPressed: { opacity: 0.9 },
  copyBtnTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  metaCell: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  metaTextCol: { flex: 1, minWidth: 0 },
  metaLbl: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 18,
  },
});
