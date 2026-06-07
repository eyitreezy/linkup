import { colors, radius, spacing } from '@/constants/theme';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type LegState = 'paid' | 'pending' | 'yours';

type Props = {
  hostShareCents: number;
  guestShareCents: number;
  hostFunded: boolean;
  guestFunded: boolean;
  currency: string;
  fundingDeadlineIso: string | null | undefined;
  currentUserIsHost: boolean;
};

function LegRow({
  label,
  cents,
  currency,
  state,
}: {
  label: string;
  cents: number;
  currency: string;
  state: LegState;
}) {
  const amount = formatEscrowMoney(cents, currency);
  return (
    <View style={[styles.leg, state === 'yours' && styles.legYours]}>
      <View style={styles.legLeft}>
        <Text style={styles.legLabel}>{label}</Text>
        <Text style={styles.legAmount}>{amount}</Text>
      </View>
      <View style={[styles.badge, state === 'paid' && styles.badgePaid, state === 'yours' && styles.badgeYours]}>
        {state === 'paid' ? (
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        ) : state === 'yours' ? (
          <Ionicons name="arrow-forward-circle" size={16} color={colors.primary} />
        ) : (
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        )}
        <Text
          style={[
            styles.badgeTxt,
            state === 'paid' && styles.badgeTxtPaid,
            state === 'yours' && styles.badgeTxtYours,
          ]}
        >
          {state === 'paid' ? 'Paid' : state === 'yours' ? 'Your turn' : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

export function EscrowSplitFundingCard({
  hostShareCents,
  guestShareCents,
  hostFunded,
  guestFunded,
  currency,
  fundingDeadlineIso,
  currentUserIsHost,
}: Props) {
  const hostState: LegState = hostFunded ? 'paid' : currentUserIsHost ? 'yours' : 'pending';
  const guestState: LegState = guestFunded ? 'paid' : !currentUserIsHost ? 'yours' : 'pending';

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rule}
      />
      <Text style={styles.kicker}>Pattern B · split escrow</Text>
      <Text style={styles.title}>Each person pays their share here</Text>
      <Text style={styles.sub}>
        Payments happen on this screen only — not during negotiation. Both legs must complete before the plan goes
        active.
      </Text>
      <LegRow label="Host share" cents={hostShareCents} currency={currency} state={hostState} />
      <LegRow label="Guest share" cents={guestShareCents} currency={currency} state={guestState} />
      {fundingDeadlineIso ? (
        <Text style={styles.deadline}>Fund by {formatIsoDateTime(fundingDeadlineIso)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  rule: { height: 3, borderRadius: 2, marginBottom: spacing.md },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  sub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.12)',
  },
  legYours: { backgroundColor: 'rgba(108, 99, 255, 0.06)', marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  legLeft: { flex: 1 },
  legLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  legAmount: { fontSize: 18, fontWeight: '900', color: colors.text },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: colors.background,
  },
  badgePaid: { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
  badgeYours: { backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  badgeTxt: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  badgeTxtPaid: { color: colors.success },
  badgeTxtYours: { color: colors.primary },
  deadline: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
});
