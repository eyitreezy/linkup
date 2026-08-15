import { GroupPlanPolicyGate } from '@/components/plans/GroupPlanPolicyGate';
import { useAuth } from '@/contexts/AuthContext';
import { peekPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';

type Props = { children: ReactNode };

/**
 * Wraps all plan-detail stack routes so GroupPlanPolicyGate runs once per user,
 * regardless of Discover swipe vs list entry path.
 */
export function GroupPlanPolicyGateLayout({ children }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const seeded = id ? peekPlanDetailSeed(id) : null;
  const [isGroupPlan, setIsGroupPlan] = useState(Boolean(seeded?.is_group_plan));
  const [resolved, setResolved] = useState(seeded?.is_group_plan != null);

  useEffect(() => {
    if (!id) {
      setResolved(true);
      return;
    }
    if (seeded?.is_group_plan != null) {
      setIsGroupPlan(Boolean(seeded.is_group_plan));
      setResolved(true);
      return;
    }
    if (!isSupabaseConfigured) {
      setResolved(true);
      return;
    }
    let cancel = false;
    void supabase
      .from('plans')
      .select('is_group_plan')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setIsGroupPlan(Boolean(data?.is_group_plan));
        setResolved(true);
      });
    return () => {
      cancel = true;
    };
  }, [id, seeded?.is_group_plan]);

  if (!resolved) return <>{children}</>;
  if (!user?.id || !isGroupPlan) return <>{children}</>;
  return <GroupPlanPolicyGate userId={user.id}>{children}</GroupPlanPolicyGate>;
}
