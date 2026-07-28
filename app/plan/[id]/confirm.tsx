import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { GroupPlanCountdownBanner } from '@/components/plans/GroupPlanCountdownBanner';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type PlanConfirmRow = Pick<
  DbPlan,
  | 'id'
  | 'title'
  | 'status'
  | 'scheduled_at'
  | 'agreed_scheduled_at'
  | 'is_group_plan'
  | 'completion_status'
  | 'creator_id'
>;

export default function ConfirmMeetupScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanConfirmRow | null>(null);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const isGroupGuest = useMemo(
    () =>
      !!plan?.is_group_plan &&
      !!user?.id &&
      plan.creator_id !== user.id &&
      plan.completion_status === 'awaiting_confirm',
    [plan, user?.id]
  );

  const confirmationDeadline = useMemo(() => {
    const scheduled = plan?.agreed_scheduled_at ?? plan?.scheduled_at;
    if (!scheduled) return null;
    return new Date(new Date(scheduled).getTime() + 24 * 60 * 60 * 1000).toISOString();
  }, [plan?.agreed_scheduled_at, plan?.scheduled_at]);

  useEffect(() => {
    if (!planId || !user?.id) return;
    void (async () => {
      const { data: planData } = await supabase
        .from('plans')
        .select(
          'id, title, status, scheduled_at, agreed_scheduled_at, is_group_plan, completion_status, creator_id'
        )
        .eq('id', planId)
        .maybeSingle();

      const row = planData as PlanConfirmRow | null;
      setPlan(row);

      if (row?.is_group_plan) {
        const { data: gpc } = await supabase
          .from('group_plan_confirmations')
          .select('user_id')
          .eq('plan_id', planId)
          .eq('user_id', user.id)
          .maybeSingle();
        setAlreadyConfirmed(!!gpc);
      } else {
        const { data: ack } = await supabase
          .from('plan_completion_acks')
          .select('user_id')
          .eq('plan_id', planId)
          .eq('user_id', user.id)
          .maybeSingle();
        setAlreadyConfirmed(!!ack);
      }
      setLoading(false);
    })();
  }, [planId, user?.id]);

  const handleConfirm = async () => {
    if (!planId || !user?.id) return;
    setConfirming(true);
    try {
      if (plan?.is_group_plan) {
        const { error } = await supabase.rpc('submit_group_guest_confirmation', {
          p_plan_id: planId,
        });
        if (error) throw error;
        Alert.alert('Attendance confirmed', 'Thank you for confirming your attendance.', [
          { text: 'Done', onPress: () => router.replace('/(tabs)' as const) },
        ]);
        return;
      }

      const { error } = await supabase.rpc('confirm_meetup_happened', { p_plan_id: planId });
      if (error) throw error;
      Alert.alert('Meetup confirmed', 'Your meetup funds are ready to withdraw.', [
        { text: 'Go to wallet', onPress: () => router.replace('/wallet') },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      Alert.alert(
        'Could not confirm',
        message === 'plan_not_confirmable'
          ? 'This meetup cannot be confirmed yet. It may not be active.'
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleReportProblem = () => {
    if (plan?.is_group_plan) {
      router.push(`/plan/${planId}/exigency`);
      return;
    }
    router.push(`/dispute/${planId}`);
  };

  if (loading) {
    return (
      <Screen safeAreaStyle={styles.screenTransparent}>
        <AppShellBackground />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const groupGuestCopy = isGroupGuest;

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <AppShellBackground />

      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {confirmationDeadline && groupGuestCopy && !alreadyConfirmed ? (
          <GroupPlanCountdownBanner
            deadlineAt={confirmationDeadline}
            label="Respond before this deadline"
          />
        ) : null}

        {alreadyConfirmed ? (
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIcon}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.confirmedTitle}>
              {plan?.is_group_plan ? 'Attendance confirmed' : 'Meetup confirmed'}
            </Text>
            <Text style={styles.confirmedBody}>
              {plan?.is_group_plan
                ? 'You have confirmed your attendance for this group meetup.'
                : 'You have already confirmed this meetup. Your funds are in your wallet.'}
            </Text>
            {!plan?.is_group_plan ? (
              <Pressable style={styles.walletButton} onPress={() => router.push('/wallet')}>
                <LinearGradient
                  colors={[colors.primary, '#8B7CF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.walletButtonGradient}
                >
                  <Text style={styles.walletButtonLabel}>Go to wallet</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.promptCard}>
            <View style={styles.promptIcon}>
              <Ionicons name="people" size={40} color={colors.primary} />
            </View>

            <Text style={styles.promptTitle}>
              {groupGuestCopy ? 'Did you attend the meetup?' : 'Did your meetup happen?'}
            </Text>

            <Text style={styles.promptPlanTitle} numberOfLines={2}>
              {plan?.title ?? 'Your meetup'}
            </Text>

            {plan?.agreed_scheduled_at || plan?.scheduled_at ? (
              <Text style={styles.promptDate}>
                {new Date(plan.agreed_scheduled_at ?? plan.scheduled_at!).toLocaleDateString(
                  'en-NG',
                  { weekday: 'long', day: 'numeric', month: 'long' }
                )}
              </Text>
            ) : null}

            <Text style={styles.promptBody}>
              {groupGuestCopy
                ? 'Your host has confirmed the meetup took place. Please confirm your own attendance.'
                : 'Confirming releases your meetup funds to your wallet. If the meetup did not happen, report a problem instead.'}
            </Text>

            <Pressable
              style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={confirming}
            >
              <LinearGradient
                colors={confirming ? [colors.border, colors.border] : [colors.primary, '#8B7CF8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButtonGradient}
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonLabel}>
                    {groupGuestCopy ? 'Yes, I attended' : 'Yes, it happened'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.reportButton} onPress={handleReportProblem} disabled={confirming}>
              <Text style={styles.reportButtonLabel}>
                {groupGuestCopy
                  ? 'I could not attend — submit an Exigency Report'
                  : 'No, report a problem'}
              </Text>
            </Pressable>

            {groupGuestCopy ? (
              <Text style={styles.promptBody}>
                If you do not respond within 24 hours of the meetup time, an automatic outcome will
                be applied and 50% of your contribution will be returned to you.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.12)',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
    flexGrow: 1,
    justifyContent: 'center',
  },
  confirmedCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  confirmedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  confirmedBody: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  walletButton: { width: '100%', borderRadius: 50, overflow: 'hidden', marginTop: spacing.sm },
  walletButtonGradient: { paddingVertical: spacing.md, alignItems: 'center' },
  walletButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  promptCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.12)',
  },
  promptIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(94,82,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  promptPlanTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  promptDate: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  promptBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  confirmButton: {
    width: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  confirmButtonDisabled: { opacity: 0.6 },
  confirmButtonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  reportButton: { paddingVertical: spacing.sm, alignItems: 'center' },
  reportButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.secondary,
    textAlign: 'center',
  },
});
