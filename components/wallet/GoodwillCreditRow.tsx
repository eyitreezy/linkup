/**
 * Single goodwill credit row — matches wallet activity row layout.
 */
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing } from '@/constants/theme';
import type { DbGoodwillCredit, SubscriptionTier } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

const SOURCE_LABELS: Record<string, string> = {
  cancellation: 'Cancellation goodwill',
  dispute_resolution: 'Dispute resolution',
  promo: 'Promotional credit',
};

function formatMoney(cents: number): string {
  return `NGN ${(cents / 100).toLocaleString()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

type Props = { credit: DbGoodwillCredit };

export function GoodwillCreditRow({ credit }: Props) {
  const remaining = credit.amount - credit.used_amount;
  const isExpired = new Date(credit.expires_at) < new Date();
  const isFullyUsed = credit.used_amount >= credit.amount;
  const tier = credit.tier_at_award as SubscriptionTier | null | undefined;

  return (
    <View style={styles.rowCard}>
      <View style={[styles.rowStripe, isExpired || isFullyUsed ? styles.stripeMuted : styles.stripeActive]} />
      <View style={styles.rowBody}>
        <View style={styles.rowLeft}>
          <View style={styles.rowTypeRow}>
            <Ionicons name="sparkles" size={14} color="#D97706" />
            <Text style={styles.rowSource}>{SOURCE_LABELS[credit.source] ?? 'Goodwill credit'}</Text>
          </View>
          <Text style={styles.rowDate}>
            Issued {formatDate(credit.created_at)} · Expires {formatDate(credit.expires_at)}
          </Text>
          {tier && tier !== 'FREE' && tier !== 'SILVER' ? (
            <View style={styles.tierRow}>
              <TierBadge tier={tier} compact />
              <Text style={styles.tierMultiplierText}>
                {tier === 'PLATINUM' ? '2× bonus' : '1.5× bonus'}
              </Text>
            </View>
          ) : null}
          {credit.used_amount > 0 ? (
            <View style={styles.appliedPill}>
              <View style={styles.appliedDot} />
              <Text style={styles.appliedPillLabel}>
                {formatMoney(credit.used_amount)} applied to fees
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmt, (isExpired || isFullyUsed) && styles.rowAmtMuted]}>
            {formatMoney(remaining)}
          </Text>
          {isExpired ? <Text style={styles.rowExpired}>Expired</Text> : null}
          {isFullyUsed && !isExpired ? <Text style={styles.rowExpired}>Used up</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowStripe: { width: 4 },
  stripeActive: { backgroundColor: '#F59E0B' },
  stripeMuted: { backgroundColor: colors.textMuted },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowTypeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowSource: { fontSize: 15, fontWeight: '900', color: colors.text },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  tierMultiplierText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  appliedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  appliedPillLabel: { fontSize: 11, fontWeight: '800', color: '#047857' },
  rowRight: { alignItems: 'flex-end' },
  rowAmt: { fontSize: 16, fontWeight: '900', color: '#B45309' },
  rowAmtMuted: { color: colors.textMuted },
  rowExpired: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginTop: 4 },
});
