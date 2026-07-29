import { ProfileReviewList } from '@/components/profile/ProfileReviewList';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import type { DbProfile } from '@/types/database';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  profile: Pick<
    DbProfile,
    | 'user_id'
    | 'host_rating_score'
    | 'host_rating_count'
    | 'host_score_punctuality'
    | 'host_score_conduct'
    | 'host_score_plan_quality'
    | 'completed_meetup_count'
  >;
};

export function ProfileRatingsSection({ profile }: Props) {
  const meetups = profile.completed_meetup_count ?? 0;
  if (meetups <= 0) return null;

  const showScore = meetups >= 3 && profile.host_rating_score != null && profile.host_rating_score > 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>Reviews</Text>
        </View>
        <LinearGradient
          colors={['rgba(94, 82, 255,0.35)', 'rgba(255, 74, 114,0.2)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionRule}
        />
      </View>

      {showScore ? (
        <View style={styles.scoreSummaryCard}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLarge}>{profile.host_rating_score!.toFixed(1)}</Text>
            <Text style={styles.starAmber}>★</Text>
            <Text style={styles.scoreCount}>
              {profile.host_rating_count}{' '}
              {profile.host_rating_count !== 1 ? 'reviews' : 'review'}
            </Text>
          </View>

          <View style={styles.dimensionBreakdown}>
            {[
              { label: 'Punctuality', value: profile.host_score_punctuality },
              { label: 'Conduct', value: profile.host_score_conduct },
              { label: 'Plan quality', value: profile.host_score_plan_quality },
            ]
              .filter((d) => d.value != null && d.value > 0)
              .map((d) => (
                <View key={d.label} style={styles.dimensionRow}>
                  <Text style={styles.dimensionLabel}>{d.label}</Text>
                  <Text style={styles.dimensionValue}>{d.value!.toFixed(1)}</Text>
                </View>
              ))}
          </View>
        </View>
      ) : (
        <Text style={styles.newToLinkUp}>New to LinkUp</Text>
      )}

      <ProfileReviewList profileUserId={profile.user_id} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionHead: { marginBottom: spacing.sm },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: { height: 2, borderRadius: 1, opacity: 0.9 },
  scoreSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreLarge: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  starAmber: {
    color: '#F59E0B',
    fontSize: 22,
    fontWeight: '700',
  },
  scoreCount: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginLeft: 4,
  },
  dimensionBreakdown: { gap: 6 },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimensionLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  dimensionValue: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  newToLinkUp: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
