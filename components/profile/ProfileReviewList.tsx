import { ReportReviewSheet } from '@/components/reviews/ReportReviewSheet';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ReviewRow = {
  id: string;
  score_punctuality: number;
  score_conduct: number;
  score_plan_quality: number | null;
  review_text: string | null;
  revealed_at: string;
  reviewer_first_name: string;
  meet_type_name: string | null;
  city: string | null;
  score_overall: number;
};

export function ProfileReviewList({ profileUserId }: { profileUserId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    void supabase
      .from('meetup_reviews')
      .select(
        `
        id,
        score_punctuality,
        score_conduct,
        score_plan_quality,
        review_text,
        revealed_at,
        plans!inner ( location_label, meet_types ( name ) ),
        reviewer:profiles!reviewer_id ( display_name )
      `
      )
      .eq('reviewee_id', profileUserId)
      .eq('reviewer_role', 'guest')
      .eq('is_hidden', false)
      .eq('is_suppressed', false)
      .gt('score_punctuality', 0)
      .order('revealed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!data) return;
        const mapped: ReviewRow[] = data.map((r: Record<string, unknown>) => {
          const planRaw = r.plans;
          const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
          const planObj = plan as {
            location_label?: string | null;
            meet_types?: { name?: string } | { name?: string }[] | null;
          } | null;
          const meetTypeRaw = planObj?.meet_types;
          const meetType = Array.isArray(meetTypeRaw) ? meetTypeRaw[0] : meetTypeRaw;
          const reviewerRaw = r.reviewer;
          const reviewer = Array.isArray(reviewerRaw) ? reviewerRaw[0] : reviewerRaw;
          const reviewerObj = reviewer as { display_name?: string | null } | null;
          const city = planObj?.location_label?.split(',')[0]?.trim() ?? null;
          const planQuality = (r.score_plan_quality as number | null) ?? (r.score_conduct as number);
          const overall = Math.round(
            planQuality * 0.4 + (r.score_conduct as number) * 0.35 + (r.score_punctuality as number) * 0.25
          );
          return {
            id: r.id as string,
            score_punctuality: r.score_punctuality as number,
            score_conduct: r.score_conduct as number,
            score_plan_quality: r.score_plan_quality as number | null,
            review_text: r.review_text as string | null,
            revealed_at: r.revealed_at as string,
            reviewer_first_name:
              reviewerObj?.display_name?.trim().split(/\s+/)[0] ?? 'A guest',
            meet_type_name: meetType?.name ?? null,
            city,
            score_overall: Math.min(5, Math.max(1, overall)),
          };
        });
        setReviews(mapped);
      });
  }, [profileUserId]);

  if (reviews.length === 0) return null;

  return (
    <View style={styles.listContainer}>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: ReviewRow }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.initialsAvatar}>
            <Text style={styles.initialsText}>
              {review.reviewer_first_name[0]?.toUpperCase() ?? 'G'}
            </Text>
          </View>
          <View style={styles.reviewerMeta}>
            <Text style={styles.reviewerName}>{review.reviewer_first_name}</Text>
            <Text style={styles.reviewMeta}>
              {[review.meet_type_name, review.city].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <View style={styles.reviewRightCol}>
          <Text style={styles.starRow}>
            {'★'.repeat(review.score_overall)}
            {'☆'.repeat(5 - review.score_overall)}
          </Text>
          <ReportReviewSheet reviewId={review.id} />
        </View>
      </View>

      {review.review_text ? <Text style={styles.reviewText}>{review.review_text}</Text> : null}

      <Text style={styles.reviewDate}>
        {new Date(review.revealed_at).toLocaleDateString('en-NG', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.1)',
    gap: spacing.xs,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  initialsAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  reviewerMeta: { flex: 1, minWidth: 0 },
  reviewerName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  reviewMeta: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  starRow: {
    color: '#F59E0B',
    fontSize: 14,
    letterSpacing: 1,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  reviewDate: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
});
