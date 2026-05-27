/**
 * Single offer row for Offers tab — status-forward, actionable.
 */
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import type { OfferDashboardRow, OfferDisplayStatus } from '@/lib/plans/fetchOffersDashboard';
import { getOfferDisplayStatus } from '@/lib/plans/fetchOffersDashboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  row: OfferDashboardRow;
  mode: 'sent' | 'received';
  busy?: boolean;
  onPressOpen: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onNegotiate?: () => void;
};

function statusColors(s: OfferDisplayStatus): { bg: string; fg: string; border: string } {
  switch (s) {
    case 'accepted':
      return { bg: 'rgba(16, 185, 129, 0.12)', fg: '#059669', border: 'rgba(16, 185, 129, 0.35)' };
    case 'rejected':
      return { bg: 'rgba(239, 68, 68, 0.1)', fg: colors.danger, border: 'rgba(239, 68, 68, 0.3)' };
    case 'expired':
      return { bg: 'rgba(107, 114, 128, 0.1)', fg: colors.textMuted, border: colors.border };
    case 'pending':
      return { bg: 'rgba(108, 99, 255, 0.12)', fg: colors.primary, border: 'rgba(108, 99, 255, 0.3)' };
    default:
      return { bg: 'rgba(107, 114, 128, 0.08)', fg: colors.textMuted, border: colors.border };
  }
}

function statusLabel(s: OfferDisplayStatus): string {
  switch (s) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Declined';
    case 'expired':
      return 'Expired';
  }
}

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return 'Open amount';
  return `${(cents / 100).toFixed(0)} ${currency}`;
}

export function OfferListCard({
  row,
  mode,
  busy,
  onPressOpen,
  onAccept,
  onReject,
  onNegotiate,
}: Props) {
  const { offer, plan, otherName, otherAvatarUrl, otherVerified } = row;
  const display = getOfferDisplayStatus(offer);
  const sc = statusColors(display);
  const ts = new Date(offer.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const amount = formatAmount(offer.amount_cents, plan.currency);
  const canActHost = mode === 'received' && display === 'pending' && !!onAccept && !!onReject;

  const btnCompact = { minHeight: 44, paddingVertical: 10 } as const;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.secondary, colors.primary, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />
      <Pressable
        onPress={onPressOpen}
        style={({ pressed }) => [styles.tapMain, pressed && styles.tapPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Open negotiation for ${plan.title}`}
      >
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.badgeText, { color: sc.fg }]}>{statusLabel(display)}</Text>
          </View>
          <Text style={styles.time}>{ts}</Text>
        </View>
        <Text style={styles.planTitle} numberOfLines={2}>
          {plan.title}
        </Text>
        <View style={styles.person}>
          <Avatar uri={otherAvatarUrl} name={otherName} size={44} />
          <View style={styles.personText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {otherName}
              </Text>
              {otherVerified ? (
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
              ) : null}
            </View>
            <Text style={styles.roleHint}>{mode === 'sent' ? 'Host' : 'Guest offer'}</Text>
          </View>
        </View>
        <Text style={styles.amount}>{amount}</Text>
      </Pressable>
      {canActHost ? (
        <View style={styles.actions}>
          <View style={styles.actionRow}>
            <Button
              title="Accept"
              onPress={() => onAccept?.()}
              disabled={busy}
              style={{ ...btnCompact, flex: 1 }}
            />
            <Button
              title="Decline"
              variant="secondary"
              onPress={() => onReject?.()}
              disabled={busy}
              style={{ ...btnCompact, flex: 1 }}
            />
          </View>
          {onNegotiate ? (
            <Button title="Counter in thread" variant="ghost" onPress={() => onNegotiate()} disabled={busy} />
          ) : null}
        </View>
      ) : mode === 'sent' && display === 'pending' ? (
        <Text style={styles.hint}>Tap above to open negotiation</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 101, 132, 0.16)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  topGlow: { height: 4, width: '100%' },
  tapMain: { padding: spacing.md },
  tapPressed: { opacity: 0.96 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  time: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  planTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3, lineHeight: 22 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  personText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  roleHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: spacing.sm },
  actions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  hint: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
