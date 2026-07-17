/**
 * Chat-styled offer row — distinct from plain text messages.
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { isOfferExpired, offerCountsTowardLimit } from '@/lib/plans/offerRules';
import { offerLiveAmount, offerStatusLabel } from '@/lib/plans/negotiationState';
import type { DbPlanOffer } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  offer: DbPlanOffer;
  currency: string;
  isMine: boolean;
  isHost: boolean;
  showHostLabel: boolean;
  /** Host manage-offers: highlight the offer selected for bottom actions. */
  selected?: boolean;
  onPress?: () => void;
};

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return 'Flexible';
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

export function OfferBubble({
  offer,
  currency,
  isMine,
  isHost,
  showHostLabel,
  selected,
  onPress,
}: Props) {
  const expired = isOfferExpired(offer);
  const alignRight = isMine;
  const statusColor =
    offer.status === 'accepted'
      ? colors.success
      : offer.status === 'declined' ||
          offer.status === 'superseded' ||
          offer.status === 'expired' ||
          offer.status === 'withdrawn' ||
          expired
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

  const bubble = (
    <View
      style={[
        styles.bubble,
        alignRight ? styles.bubbleMine : styles.bubbleTheirs,
        expired && styles.bubbleDim,
        selected && styles.bubbleSelected,
      ]}
    >
        <View style={styles.badgeRow}>
          <Ionicons name="chatbubbles-outline" size={14} color={colors.primary} />
          <Text style={styles.badgeTxt}>Idea · round {offer.round}</Text>
          {showHostLabel && isHost ? <Text style={styles.hostTag}>Host</Text> : null}
        </View>
        <Text style={styles.amount}>{formatMoney(offerLiveAmount(offer), currency)}</Text>
        {formatWhen(offer.proposed_scheduled_at) ? (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.meta}>{formatWhen(offer.proposed_scheduled_at)}</Text>
          </View>
        ) : null}
        {offer.message ? <Text style={styles.note}>{offer.message}</Text> : null}
        <Text style={[styles.status, { color: statusColor }]}>
          {offerStatusLabel(offer)}
        </Text>
        {expiresLine && offerCountsTowardLimit(offer) && !expired ? (
          <Text style={styles.expires}>{expiresLine}</Text>
        ) : null}
    </View>
  );

  return (
    <View style={[styles.wrap, alignRight ? styles.wrapRight : styles.wrapLeft]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [pressed && styles.bubblePressed]}
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6, maxWidth: '100%' },
  bubblePressed: { opacity: 0.92 },
  bubbleSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  wrapLeft: { alignSelf: 'flex-start' },
  wrapRight: { alignSelf: 'flex-end' },
  bubble: {
    maxWidth: 300,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.22)',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  bubbleMine: {
    backgroundColor: '#F0EEFF',
    borderColor: 'rgba(94, 82, 255, 0.38)',
  },
  bubbleTheirs: {},
  bubbleDim: { opacity: 0.72 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  badgeTxt: { fontSize: 12, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
  hostTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.secondary,
    textTransform: 'uppercase',
  },
  amount: { fontSize: 20, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  meta: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular, },
  note: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20, fontFamily: fonts.regular, },
  status: { fontSize: 12, fontWeight: '700', marginTop: 8, textTransform: 'capitalize', fontFamily: fonts.medium, },
  expires: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontFamily: fonts.regular, },
});
