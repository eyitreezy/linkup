/**
 * Host — review join requests for non-negotiable plans.
 */
import { JoinRequestRow } from '@/components/plans/joinRequests/JoinRequestRow';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { Screen } from '@/components/Screen';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { colors, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchPlanJoinRequests,
  respondToJoinRequest,
  type JoinRequestWithRequester,
} from '@/lib/plans/joinRequests';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { peekPlanDetailSeed, setPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ManageRequestsScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(() => (planId ? peekPlanDetailSeed(planId) : null));
  const [requests, setRequests] = useState<JoinRequestWithRequester[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refetchRequests = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) return;
    setRequests(await fetchPlanJoinRequests(planId));
  }, [planId]);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: pRow } = await supabase.from('plans').select('*').eq('id', planId).single();
      if (pRow) {
        const next = pRow as DbPlan;
        setPlan(next);
        setPlanDetailSeed(planId, next);
      }
      await refetchRequests();
    } finally {
      setIsLoading(false);
    }
  }, [planId, refetchRequests]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!planId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`join-requests-${planId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_join_requests',
          filter: `plan_id=eq.${planId}`,
        },
        () => {
          void refetchRequests();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [planId, refetchRequests]);

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const responded = useMemo(() => requests.filter((r) => r.status !== 'pending'), [requests]);
  const slotLabel = plan ? resolveJoinRequestSlotCentsLabel(plan) : '';

  async function runRespond(requestId: string, action: 'approve' | 'decline') {
    setBusyId(requestId);
    try {
      await respondToJoinRequest(requestId, action);
      await refetchRequests();
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  function handleRespond(requestId: string, action: 'approve' | 'decline') {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;
    if (action === 'decline') {
      Alert.alert(
        'Decline request?',
        `Decline ${request.requester?.display_name ?? 'this guest'}'s request to join?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Decline', style: 'destructive', onPress: () => void runRespond(requestId, action) },
        ]
      );
      return;
    }
    void runRespond(requestId, action);
  }

  if (!plan && isLoading) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Manage requests" />
        <PlanScreenLoading title="Loading requests" subtitle="Fetching join requests for this plan." />
      </Screen>
    );
  }

  if (!plan || plan.creator_id !== user?.id) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Manage requests" />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Not available</Text>
          <Text style={styles.emptySub}>Only the host can manage join requests for this plan.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
      <AppShellBackground />
      <PlanStackScreenHeader title="Manage requests" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{plan.title}</Text>
          <Text style={styles.introSub}>
            Guests request to join at the formula share{slotLabel ? ` (${slotLabel})` : ''}. Approve to
            create their escrow leg at that price.
          </Text>
        </View>

        {pending.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{`Pending (${pending.length})`}</Text>
            {pending.map((request) => (
              <JoinRequestRow
                key={request.id}
                request={request}
                busy={busyId === request.id}
                onApprove={() => handleRespond(request.id, 'approve')}
                onDecline={() => handleRespond(request.id, 'decline')}
              />
            ))}
          </View>
        ) : null}

        {responded.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Responded</Text>
            {responded.map((request) => (
              <JoinRequestRow key={request.id} request={request} />
            ))}
          </View>
        ) : null}

        {requests.length === 0 && !isLoading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptySub}>
              When guests request to join your plan, they will appear here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  introCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  introSub: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 21,
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
