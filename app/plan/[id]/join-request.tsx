/**
 * Guest — view pending join request status.
 */
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, spacing, fonts, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchGuestEscrowIdForJoinRequest,
  fetchMyJoinRequest,
} from '@/lib/plans/joinRequests';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { peekPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan, JoinRequestStatus } from '@/types/database';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

function statusCopy(status: JoinRequestStatus): { title: string; body: string } {
  switch (status) {
    case 'approved':
      return {
        title: 'Request approved',
        body: 'Your slot is reserved. Fund your share to confirm your place on this plan.',
      };
    case 'declined':
      return {
        title: 'Request not approved',
        body: 'The host did not approve your request. You can explore other plans on LinkUp.',
      };
    default:
      return {
        title: 'Request pending',
        body: 'The host will review your request. You will be notified when they respond.',
      };
  }
}

export default function MyJoinRequestScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(() => (planId ? peekPlanDetailSeed(planId) : null));
  const [status, setStatus] = useState<JoinRequestStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId || !user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: pRow }, req] = await Promise.all([
        supabase.from('plans').select('*').eq('id', planId).single(),
        fetchMyJoinRequest(planId, user.id),
      ]);
      if (pRow) setPlan(pRow as DbPlan);
      setStatus(req?.status ?? null);
    } finally {
      setLoading(false);
    }
  }, [planId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!planId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`my-join-request-${planId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_join_requests',
          filter: `plan_id=eq.${planId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [planId, load]);

  async function goFund() {
    if (!planId || !user?.id) return;
    const escrowId = await fetchGuestEscrowIdForJoinRequest(planId, user.id);
    if (escrowId) {
      router.push(`/escrow/${escrowId}` as Href);
      return;
    }
    router.push(`/plan/${planId}/agreement` as Href);
  }

  const copy = status ? statusCopy(status) : null;
  const slotLabel = plan ? resolveJoinRequestSlotCentsLabel(plan) : '';

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
      <AppShellBackground />
      <PlanStackScreenHeader title="Your request" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !copy ? (
          <View style={styles.card}>
            <Text style={styles.title}>No request found</Text>
            <Text style={styles.body}>You have not sent a join request for this plan yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.kicker}>Join request</Text>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>
            {slotLabel ? <Text style={styles.slot}>Formula share: {slotLabel}</Text> : null}
            {status === 'approved' ? (
              <Button
                title="Fund your share"
                gradient
                pill
                fullWidth
                onPress={() => void goFund()}
                style={styles.cta}
              />
            ) : null}
            {status === 'declined' ? (
              <Button
                title="Explore plans"
                gradient
                pill
                fullWidth
                onPress={() => router.push('/(tabs)' as Href)}
                style={styles.cta}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 22,
  },
  slot: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  cta: { marginTop: spacing.lg },
});
