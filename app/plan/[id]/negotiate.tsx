/**
 * PL5 — negotiation timeline + offer composer.
 */
import { Screen } from '@/components/Screen';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { NegotiationChat } from '@/components/plans/negotiation/NegotiationChat';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { colors, spacing } from '@/constants/theme';
import { peekPlanDetailSeed, setPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const GRADIENT_COLORS = [
  colors.discoveryGradientTop,
  colors.discoveryGradientMid,
  colors.discoveryGradientBottom,
] as const;

function NegotiateShell({ children }: { children: React.ReactNode }) {
  return (
    <Screen
      safeAreaEdges={['top', 'left', 'right']}
      safeAreaStyle={styles.screenTransparent}
      style={styles.screenTransparent}
    >
      <LinearGradient
        colors={[...GRADIENT_COLORS]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.fill}>{children}</View>
    </Screen>
  );
}

export default function PlanNegotiateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<DbPlan | null>(() => (id ? peekPlanDetailSeed(id) : null));
  const [refreshing, setRefreshing] = useState(!plan);

  useEffect(() => {
    if (!id) {
      setPlan(null);
      return;
    }
    const seeded = peekPlanDetailSeed(id);
    if (seeded) setPlan(seeded);
  }, [id]);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) {
      setRefreshing(false);
      return;
    }
    const hadPlan = Boolean(peekPlanDetailSeed(id));
    if (!hadPlan) setRefreshing(true);
    try {
      const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
      if (p) {
        const next = p as DbPlan;
        setPlan(next);
        setPlanDetailSeed(id, next);
      }
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!plan && refreshing) {
    return (
      <NegotiateShell>
        <PlanStackScreenHeader
          title="Manage offers"
          barStyle={styles.headerOnGradient}
          titleStyle={styles.negotiateHeaderTitle}
        />
        <PlanScreenLoading
          title="Opening offers"
          subtitle="Loading this plan’s negotiation timeline."
        />
      </NegotiateShell>
    );
  }

  if (!plan) {
    return (
      <NegotiateShell>
        <PlanStackScreenHeader
          title="Manage offers"
          barStyle={styles.headerOnGradient}
          titleStyle={styles.negotiateHeaderTitle}
        />
        <View style={styles.missingWrap}>
          <PlanScreenLoading title="Plan not found" subtitle="This plan may have been removed or the link is outdated." />
        </View>
      </NegotiateShell>
    );
  }

  return (
    <NegotiateShell>
      <PlanStackScreenHeader
        title="Manage offers"
        barStyle={styles.headerOnGradient}
        titleStyle={styles.negotiateHeaderTitle}
      />
      <View style={styles.chatWrap}>
        <NegotiationChat plan={plan} />
        {refreshing ? (
          <View style={styles.refreshBar} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      </View>
    </NegotiateShell>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { flex: 1, backgroundColor: 'transparent' },
  headerOnGradient: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  negotiateHeaderTitle: {
    fontSize: 18,
    letterSpacing: -0.5,
  },
  fill: { flex: 1 },
  chatWrap: { flex: 1 },
  refreshBar: {
    position: 'absolute',
    top: spacing.xs,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  missingWrap: { flex: 1, justifyContent: 'center' },
});
