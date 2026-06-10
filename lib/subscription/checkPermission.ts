import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { SubscriptionTier } from '@/lib/subscription/pricing';

export type PermissionResult = {
  allowed: boolean;
  effectiveTier: SubscriptionTier;
  reason?: string;
  upgradeTo?: SubscriptionTier;
  metadata?: Record<string, unknown>;
};

type CacheEntry = {
  result: PermissionResult;
  at: number;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
let cacheEpoch = 0;

export function invalidatePermissionCache(): void {
  cache.clear();
  cacheEpoch += 1;
}

function cacheKey(userId: string, feature: string, checkQuota: boolean): string {
  return `${cacheEpoch}:${userId}:${feature}:${checkQuota ? '1' : '0'}`;
}

export async function checkPermission(
  userId: string,
  feature: string,
  options?: { checkQuota?: boolean }
): Promise<PermissionResult> {
  const checkQuota = options?.checkQuota ?? false;
  const key = cacheKey(userId, feature, checkQuota);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.result;
  }

  if (!isSupabaseConfigured) {
    return { allowed: false, effectiveTier: 'FREE', reason: 'Not configured' };
  }

  const { data, error } = await supabase.functions.invoke('permission-service', {
    body: { user_id: userId, feature, check_quota: checkQuota },
  });

  if (error) {
    return { allowed: false, effectiveTier: 'FREE', reason: error.message };
  }

  const body = data as {
    allowed?: boolean;
    effective_tier?: SubscriptionTier;
    reason?: string;
    upgrade_to?: SubscriptionTier;
    metadata?: Record<string, unknown>;
  };

  const result: PermissionResult = {
    allowed: !!body.allowed,
    effectiveTier: body.effective_tier ?? 'FREE',
    reason: body.reason,
    upgradeTo: body.upgrade_to,
    metadata: body.metadata,
  };

  cache.set(key, { result, at: Date.now() });
  return result;
}
