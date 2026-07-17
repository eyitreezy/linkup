/**
 * Single offer row for Offers tab — matches linkup-web layout; navigate via title or chevron.
 */
import { Avatar } from '@/components/Avatar';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import type { OfferDashboardRow, OfferDisplayStatus } from '@/lib/plans/fetchOffersDashboard';
import { getOfferDisplayStatus } from '@/lib/plans/fetchOffersDashboard';
import { deriveNegotiationContext, isOfferLive } from '@/lib/plans/negotiationState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  row: OfferDashboardRow;
  mode: 'sent' | 'received';
  currentUserId?: string;
  busy?: boolean;
  onOpenNegotiate?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
};

function statusColors(s: OfferDisplayStatus): { bg: string; fg: string; border: string } {
  switch (s) {
    case 'accepted':
      return { bg: 'rgba(16, 185, 129, 0.12)', fg: '#059669', border: 'rgba(16, 185, 129, 0.35)' };
    case 'rejected':
      return { bg: 'rgba(239, 68, 68, 0.1)', fg: colors.danger, border: 'rgba(239, 68, 68, 0.3)' };
    case 'expired':
      return { bg: 'rgba(243, 244, 246, 1)', fg: colors.textMuted, border: colors.border };
    case 'pending':
      return { bg: 'rgba(94, 82, 255, 0.12)', fg: colors.primary, border: 'rgba(94, 82, 255, 0.3)' };
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

function formatAmount(cents: number | null | undefined, currency: string): string {
  if (cents == null) return 'Open amount';
  if (currency === 'NGN') return `₦${(cents / 100).toLocaleString()}`;
  return `${(cents / 100).toFixed(0)} ${currency}`;
}

export function OfferListCard({
  row,
  mode,
  currentUserId,
  busy,
  onOpenNegotiate,
  onAccept,
  onReject,
  onCounter,
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
  const amountCents = offer.current_amount_cents ?? offer.amount_cents;
  const amount = formatAmount(amountCents, plan.currency);
  const ctx = currentUserId ? deriveNegotiationContext(offer, plan, currentUserId) : null;
  const showActions =
    display === 'pending' &&
    isOfferLive(offer) &&
    ctx?.isMyTurn &&
    !!onAccept &&
    !!onReject &&
    ((mode === 'received' && ctx.isHost) || (mode === 'sent' && ctx.isGuest));

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.secondary, colors.primary, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.badgeText, { color: sc.fg }]}>{statusLabel(display)}</Text>
          </View>
          <Text style={styles.time}>{ts}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!onOpenNegotiate}
          onPress={onOpenNegotiate}
          style={({ pressed }) => [pressed && onOpenNegotiate && styles.pressed]}
        >
          <Text style={styles.planTitle} numberOfLines={2}>
            {plan.title}
          </Text>
          <Text style={styles.amount}>{amount}</Text>
          {offer.message ? (
            <Text style={styles.message} numberOfLines={2}>
              {offer.message}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.personRow}>
          <Avatar uri={otherAvatarUrl} name={otherName} size={44} />
          <View style={styles.personText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {mode === 'sent' ? 'Host' : 'Guest'}: {otherName}
              </Text>
              {otherVerified ? (
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              ) : null}
            </View>
            <Text style={styles.location} numberOfLines={1}>
              {plan.location_label ?? 'Location TBC'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open manage offers"
            disabled={!onOpenNegotiate}
            onPress={onOpenNegotiate}
            style={({ pressed }) => [styles.chevronBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {showActions ? (
          <View style={styles.actions}>
            <View style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => onAccept?.()}
                style={({ pressed }) => [styles.acceptOuter, styles.actionFlex, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={[...APP_CTA_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionBtn}
                >
                  <Text style={styles.acceptLabel}>Accept</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => onReject?.()}
                style={({ pressed }) => [styles.declineBtn, styles.actionFlex, pressed && styles.pressed]}
              >
                <Text style={styles.declineLabel}>Decline</Text>
              </Pressable>
            </View>
            {onCounter ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onCounter}
                style={({ pressed }) => [styles.counterBtn, pressed && styles.pressed]}
              >
                <Text style={styles.counterLabel}>Counter / negotiate</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(216, 220, 230, 0.9)',
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  topGlow: { height: 4, width: '100%' },
  body: { padding: spacing.md, paddingTop: spacing.lg },
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
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  time: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 24,
    fontFamily: fonts.bold,
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginTop: spacing.sm,
    fontFamily: fonts.bold,
    letterSpacing: -0.4,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  personText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
    fontFamily: fonts.bold,
  },
  location: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: fonts.medium,
  },
  chevronBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(237, 232, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
    minWidth: 0,
  },
  acceptOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  actionBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  acceptLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  declineBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  declineLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  counterBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.25)',
    backgroundColor: 'rgba(237, 232, 255, 0.5)',
    paddingHorizontal: spacing.md,
  },
  counterLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  pressed: { opacity: 0.92 },
});
