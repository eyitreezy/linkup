/**
 * PL5 — negotiation timeline + offer composer.
 */
import { Screen } from '@/components/Screen';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { NegotiationChat } from '@/components/plans/negotiation/NegotiationChat';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function PlanNegotiateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<DbPlan | null>(null);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) return;
    const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
    if (p) setPlan(p as DbPlan);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!plan) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <PlanStackScreenHeader title="Negotiate" />
        <PlanScreenLoading
          title="Loading negotiation"
          subtitle="Opening the offer timeline and messages for this plan."
        />
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <PlanStackScreenHeader title="Negotiate" />
      <View style={styles.fill}>
        <NegotiationChat plan={plan} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
