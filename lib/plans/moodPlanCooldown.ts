import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { SubscriptionTier } from '@/lib/subscription/pricing';

export type MoodCooldownResult = {
  in_cooldown: boolean;
  cooldown_ends_at?: string;
  hours_remaining?: number;
  effective_tier?: SubscriptionTier;
};

export async function getMoodPlanCooldown(userId: string): Promise<MoodCooldownResult> {
  if (!isSupabaseConfigured) {
    return { in_cooldown: false };
  }

  const { data, error } = await supabase.functions.invoke('get-mood-plan-cooldown', {
    body: { user_id: userId },
  });

  if (error) {
    return { in_cooldown: false };
  }

  return (data ?? { in_cooldown: false }) as MoodCooldownResult;
}

export type ExtendMoodPlanResult = {
  extended: boolean;
  new_expires_at?: string;
  reason?: string;
};

export async function extendMoodPlan(planId: string, userId: string): Promise<ExtendMoodPlanResult> {
  if (!isSupabaseConfigured) {
    return { extended: false, reason: 'Not configured' };
  }

  const { data, error } = await supabase.functions.invoke('extend-mood-plan', {
    body: { plan_id: planId, user_id: userId },
  });

  if (error) {
    return { extended: false, reason: error.message };
  }

  return (data ?? { extended: false }) as ExtendMoodPlanResult;
}
