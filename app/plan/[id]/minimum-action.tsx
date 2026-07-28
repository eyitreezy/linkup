import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { PLATFORM_FEE_REFUND_MINIMUM_CANCEL_MESSAGE } from '@/lib/plans/platformFeeRefundCopy';
import { supabase } from '@/lib/supabase';
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
  View,
} from 'react-native';

export default function MinimumActionScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [minimumCount, setMinimumCount] = useState(5);

  useEffect(() => {
    if (!planId || !user?.id) {
      setCheckingAccess(false);
      return;
    }
    void supabase
      .from('plans')
      .select('creator_id, accepted_guest_count, minimum_member_count, is_group_plan')
      .eq('id', planId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data?.is_group_plan || data.creator_id !== user.id) {
          Alert.alert('Unavailable', 'This screen is only for the Group Plan host.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
          return;
        }
        setMemberCount((data.accepted_guest_count ?? 0) + 1);
        setMinimumCount(data.minimum_member_count ?? 5);
        setCheckingAccess(false);
      });
  }, [planId, user?.id]);

  const handleAction = async (action: 'extend_registration' | 'proceed_smaller' | 'cancel') => {
    if (!planId) return;
    setIsLoading(true);
    const { error } = await supabase.rpc('submit_host_minimum_action', {
      p_plan_id: planId,
      p_action: action,
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    if (action === 'cancel') {
      Alert.alert(
        'Group Plan cancelled',
        PLATFORM_FEE_REFUND_MINIMUM_CANCEL_MESSAGE,
        [{ text: 'OK', onPress: () => router.replace('/wallet' as const) }]
      );
      return;
    }

    router.replace(`/plan/${planId}` as const);
  };

  if (checkingAccess) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <AppShellBackground />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
      <AppShellBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your group needs more members</Text>
        <Text style={styles.count}>
          {memberCount} of {minimumCount} members confirmed
        </Text>
        <Text style={styles.body}>
          Your meetup is in 48 hours and has not reached the minimum of {minimumCount} members.
          Choose one of the options below. If you do not respond within 24 hours, the plan will
          be automatically cancelled and all contributions refunded.
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={styles.primaryOuter}
              onPress={() => void handleAction('extend_registration')}
            >
              <LinearGradient
                colors={[colors.primary, '#8B7CF8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryLabel}>Extend registration period</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => void handleAction('proceed_smaller')}
            >
              <Text style={styles.secondaryLabel}>Proceed as a smaller private group</Text>
            </Pressable>

            <Pressable
              style={styles.destructiveButton}
              onPress={() => void handleAction('cancel')}
            >
              <Text style={styles.destructiveLabel}>Cancel the Group Plan</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.caption}>{PLATFORM_FEE_REFUND_MINIMUM_CANCEL_MESSAGE}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing.lg, gap: spacing.md },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  count: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontFamily: fonts.regular,
  },
  actions: { gap: spacing.sm },
  primaryOuter: { borderRadius: radius.button, overflow: 'hidden' },
  primaryGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    textAlign: 'center',
  },
  destructiveButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.danger,
  },
  destructiveLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  caption: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: fonts.regular,
  },
});
