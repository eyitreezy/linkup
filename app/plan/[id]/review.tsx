import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function StarPicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            style={styles.starButton}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Text style={[styles.starChar, star <= value ? styles.starFilled : styles.starEmpty]}>
              ★
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ReviewScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [isHost, setIsHost] = useState(false);
  const [revieweeName, setRevieweeName] = useState('');
  const [scores, setScores] = useState({ punctuality: 0, conduct: 0, plan_quality: 0 });
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!planId || !user?.id) {
      setIsLoading(false);
      return;
    }

    let cancel = false;
    void (async () => {
      const { data: plan } = await supabase
        .from('plans')
        .select('creator_id, review_unlock_at, is_group_plan')
        .eq('id', planId)
        .maybeSingle();

      if (cancel) return;

      if (!plan?.review_unlock_at) {
        router.replace(`/plan/${planId}` as const);
        return;
      }

      const userIsHost = plan.creator_id === user.id;
      setIsHost(userIsHost);

      const { data: existing } = await supabase
        .from('meetup_reviews')
        .select('score_punctuality')
        .eq('plan_id', planId)
        .eq('reviewer_id', user.id)
        .maybeSingle();

      if (existing?.score_punctuality && existing.score_punctuality > 0) {
        setAlreadySubmitted(true);
        setIsLoading(false);
        return;
      }

      if (userIsHost) {
        const { data: offer } = await supabase
          .from('plan_offers')
          .select('bidder_id')
          .eq('plan_id', planId)
          .eq('status', 'accepted')
          .limit(1)
          .maybeSingle();
        if (offer?.bidder_id) {
          const { data: guestProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', offer.bidder_id)
            .maybeSingle();
          setRevieweeName(guestProfile?.display_name?.split(' ')[0] ?? 'your guest');
        } else {
          setRevieweeName('your guest');
        }
      } else {
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', plan.creator_id)
          .maybeSingle();
        setRevieweeName(hostProfile?.display_name?.split(' ')[0] ?? 'your host');
      }

      setIsLoading(false);
    })();

    return () => {
      cancel = true;
    };
  }, [planId, user?.id]);

  const handleSubmit = async () => {
    if (!planId) return;
    setError('');

    if (scores.punctuality === 0 || scores.conduct === 0) {
      setError('Please rate both punctuality and conduct before submitting.');
      return;
    }
    if (!isHost && scores.plan_quality === 0) {
      setError('Please rate plan quality before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('submit_review', {
        p_plan_id: planId,
        p_score_punctuality: scores.punctuality,
        p_score_conduct: scores.conduct,
        p_score_plan_quality: !isHost ? scores.plan_quality : null,
        p_review_text: reviewText.trim() || null,
      });

      if (rpcError) throw rpcError;

      Alert.alert(
        'Review submitted',
        'Your review will be revealed once both parties have submitted, or after 7 days.',
        [{ text: 'Done', onPress: () => router.replace(`/plan/${planId}` as const) }]
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <AppShellBackground />
        <View style={styles.centeredContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (alreadySubmitted) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <AppShellBackground />
        <PlanStackScreenHeader title="Review submitted" />
        <View style={styles.centeredContainer}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={styles.alreadySubmittedText}>
            You have already submitted your review for this meetup.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonLabel}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
      <AppShellBackground />
      <PlanStackScreenHeader title="Rate your meetup" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>How was your meetup with {revieweeName}?</Text>

        <Text style={styles.subheading}>
          Your review is private until both parties have submitted, or 7 days have passed.
        </Text>

        <StarPicker
          label="Punctuality"
          hint="Did they arrive on time and communicate any delays?"
          value={scores.punctuality}
          onChange={(v) => setScores((s) => ({ ...s, punctuality: v }))}
        />

        <StarPicker
          label="Respect and conduct"
          hint="Were they courteous and as described on their profile?"
          value={scores.conduct}
          onChange={(v) => setScores((s) => ({ ...s, conduct: v }))}
        />

        {!isHost ? (
          <StarPicker
            label="Plan quality"
            hint="Did the meetup match what was described in the plan?"
            value={scores.plan_quality}
            onChange={(v) => setScores((s) => ({ ...s, plan_quality: v }))}
          />
        ) : null}

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            Written review <Text style={styles.fieldLabelOptional}>(optional)</Text>
          </Text>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Share what made this meetup memorable, or what could have been better."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{reviewText.length}/500</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.primaryButtonOuter, isSubmitting && styles.primaryDisabled]}
          onPress={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={isSubmitting ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonLabel}>Submit review</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.editWindowNote}>
          You can edit your review within 24 hours. After that it is permanently locked.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  fieldContainer: { gap: 4 },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  fieldLabelOptional: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  starButton: { padding: 2 },
  starChar: { fontSize: 32 },
  starFilled: { color: '#F59E0B' },
  starEmpty: { color: '#D1D5DB' },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.regular,
    minHeight: 120,
    marginTop: 4,
    backgroundColor: colors.surface,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    fontFamily: fonts.medium,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.danger,
  },
  primaryButtonOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  primaryDisabled: { opacity: 0.65 },
  primaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  editWindowNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  alreadySubmittedText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: fonts.medium,
    paddingHorizontal: spacing.md,
  },
});
