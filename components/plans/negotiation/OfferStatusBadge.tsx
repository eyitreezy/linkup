import { colors, fonts } from '@/constants/theme';
import { isOfferExpired } from '@/lib/plans/offerRules';
import type { OfferStatus } from '@/types/database';
import { StyleSheet, Text, View } from 'react-native';

const STATUS_CONFIG: Record<
  OfferStatus,
  { label: string; bg: string; fg: string }
> = {
  pending: { label: 'Awaiting response', bg: 'rgba(245, 158, 11, 0.12)', fg: '#92400E' },
  countered: { label: 'Countered', bg: 'rgba(255, 74, 114, 0.12)', fg: colors.secondary },
  countered_by_host: { label: 'Host countered', bg: 'rgba(94, 82, 255, 0.12)', fg: colors.primary },
  countered_by_guest: { label: 'Guest countered', bg: 'rgba(147, 51, 234, 0.12)', fg: '#7C3AED' },
  accepted: { label: 'Accepted', bg: 'rgba(16, 185, 129, 0.12)', fg: '#059669' },
  declined: { label: 'Declined', bg: 'rgba(239, 68, 68, 0.12)', fg: '#DC2626' },
  withdrawn: { label: 'Withdrawn', bg: 'rgba(91, 101, 119, 0.12)', fg: colors.textMuted },
  superseded: { label: 'Superseded', bg: 'rgba(91, 101, 119, 0.12)', fg: colors.textMuted },
  expired: { label: 'Expired', bg: 'rgba(91, 101, 119, 0.15)', fg: colors.textMuted },
};

type Props = {
  status: OfferStatus;
  expired?: boolean;
};

export function OfferStatusBadge({ status, expired }: Props) {
  const config =
    expired && status === 'pending' ? STATUS_CONFIG.expired : STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

export function offerBadgeExpired(
  offer: Parameters<typeof isOfferExpired>[0]
): boolean {
  return isOfferExpired(offer);
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
});
