/**
 * Chat-styled offer row — distinct from plain text messages.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { DbPlanOffer } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  offer: DbPlanOffer;
  currency: string;
  isMine: boolean;
  isHost: boolean;
  showHostLabel: boolean;
};

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return 'Open amount';
  return `${(cents / 100).toFixed(0)} ${currency}`;
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OfferBubble({ offer, currency, isMine, isHost, showHostLabel }: Props) {
  const expired = isOfferExpired(offer);
  const alignRight = isMine;
  const statusColor =
    offer.status === 'accepted'
      ? colors.success
      : offer.status === 'declined' || offer.status === 'superseded' || offer.status === 'expired' || expired
        ? colors.textMuted
        : colors.primary;

  const expiresLine = offer.expires_at
    ? `Expires ${new Date(offer.expires_at).toLocaleString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
      })}`
    : null;

  return (
    <View style={[styles.wrap, alignRight ? styles.wrapRight : styles.wrapLeft]}>
      <View style={[styles.bubble, alignRight ? styles.bubbleMine : styles.bubbleTheirs, expired && styles.bubbleDim]}>
        <View style={styles.badgeRow}>
          <Ionicons name="pricetag" size={14} color={colors.primary} />
          <Text style={styles.badgeTxt}>Offer · Round {offer.round}</Text>
          {showHostLabel && isHost ? <Text style={styles.hostTag}>Host</Text> : null}
        </View>
        <Text style={styles.amount}>{formatMoney(offer.amount_cents, currency)}</Text>
        {formatWhen(offer.proposed_scheduled_at) ? (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.meta}>{formatWhen(offer.proposed_scheduled_at)}</Text>
          </View>
        ) : null}
        {offer.message ? <Text style={styles.note}>{offer.message}</Text> : null}
        <Text style={[styles.status, { color: statusColor }]}>
          {expired && offer.status === 'pending' ? 'Expired' : offer.status}
        </Text>
        {expiresLine && offer.status === 'pending' && !expired ? (
          <Text style={styles.expires}>{expiresLine}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6, paddingHorizontal: spacing.md, maxWidth: '100%' },
  wrapLeft: { alignSelf: 'flex-start' },
  wrapRight: { alignSelf: 'flex-end' },
  bubble: {
    maxWidth: 300,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.25)',
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  bubbleMine: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    borderColor: 'rgba(108, 99, 255, 0.35)',
  },
  bubbleTheirs: {},
  bubbleDim: { opacity: 0.72 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  badgeTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  hostTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.secondary,
    textTransform: 'uppercase',
  },
  amount: { fontSize: 20, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  meta: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
  expires: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
