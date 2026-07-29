import { colors, fonts } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  hostRatingScore?: number | null;
  hostRatingCount?: number | null;
  completedMeetupCount?: number | null;
  /** compact: ★ 4.8 (12) — detail: ★ 4.8 · 12 reviews */
  variant?: 'compact' | 'detail';
};

export function HostRatingBadge({
  hostRatingScore,
  hostRatingCount = 0,
  completedMeetupCount = 0,
  variant = 'compact',
}: Props) {
  const meetups = completedMeetupCount ?? 0;
  const count = hostRatingCount ?? 0;
  const score = hostRatingScore;

  if (meetups >= 3 && score != null && score > 0) {
    return (
      <View style={styles.ratingBadgeRow}>
        <Text style={styles.starAmber}>★</Text>
        <Text style={styles.ratingScore}>{score.toFixed(1)}</Text>
        {variant === 'detail' ? (
          <Text style={styles.ratingCount}>
            {count} {count !== 1 ? 'reviews' : 'review'}
          </Text>
        ) : (
          <Text style={styles.ratingCount}>({count})</Text>
        )}
      </View>
    );
  }

  if (meetups > 0) {
    return <Text style={styles.newToLinkUp}>New to LinkUp</Text>;
  }

  return null;
}

const styles = StyleSheet.create({
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  starAmber: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  ratingScore: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  ratingCount: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  newToLinkUp: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
});
