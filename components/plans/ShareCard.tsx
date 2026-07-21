import { colors, fonts, radius } from '@/constants/theme';
import { forwardRef, type ComponentRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export type ShareCardProps = {
  meetTypeName: string;
  meetTypeImageUrl?: string | null;
  planTitle?: string | null;
  city: string;
  meetDate?: string | null;
  priceDisplay?: string | null;
  slotsLeft?: number | null;
  hostFirstName: string;
  hostVerified?: boolean;
};

export const ShareCard = forwardRef<ComponentRef<typeof View>, ShareCardProps>(function ShareCard(
  {
    meetTypeName,
    meetTypeImageUrl,
    planTitle,
    city,
    meetDate,
    priceDisplay,
    slotsLeft,
    hostFirstName,
    hostVerified,
  },
  ref
) {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <View style={styles.header}>
        <Text style={styles.brandName}>LinkUp</Text>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>Verified Meetup</Text>
        </View>
      </View>

      {meetTypeImageUrl ? (
        <Image source={{ uri: meetTypeImageUrl }} style={styles.meetTypeImage} resizeMode="cover" />
      ) : (
        <View style={styles.meetTypeImagePlaceholder}>
          <Text style={styles.meetTypeInitial}>{meetTypeName[0]?.toUpperCase() ?? 'L'}</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.meetTypeName}>{meetTypeName}</Text>
        <Text style={styles.planTitle} numberOfLines={2}>
          {planTitle?.trim() || `${meetTypeName} in ${city}`}
        </Text>

        <View style={styles.detailsRow}>
          {meetDate ? <Text style={styles.detailText}>{meetDate}</Text> : null}
          <Text style={styles.detailText}>{city}</Text>
        </View>

        {priceDisplay ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{priceDisplay}</Text>
          </View>
        ) : null}

        {slotsLeft != null && slotsLeft > 0 ? (
          <View style={styles.slotsBadge}>
            <View style={styles.slotsIndicator} />
            <Text style={styles.slotsText}>
              {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} remaining
            </Text>
          </View>
        ) : null}

        <Text style={styles.hostLine}>
          Hosted by <Text style={styles.hostName}>{hostFirstName}</Text>
          {hostVerified ? <Text style={styles.verifiedMark}> · Verified</Text> : null}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>linkup.app</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  meetTypeImage: {
    width: '100%',
    height: 160,
  },
  meetTypeImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetTypeInitial: {
    fontSize: 64,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
    gap: 10,
  },
  meetTypeName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    lineHeight: 28,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  priceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.success,
  },
  slotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232, 144, 8, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
  },
  slotsIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  slotsText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.warning,
  },
  hostLine: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    marginTop: 4,
  },
  hostName: {
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  verifiedMark: {
    color: colors.primary,
    fontWeight: '700',
    fontFamily: fonts.medium,
  },
  footer: {
    backgroundColor: colors.authInputBg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    fontFamily: fonts.medium,
  },
});
