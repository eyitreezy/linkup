import { useAuth } from '@/contexts/AuthContext';
import { checkPermission, type PermissionResult } from '@/lib/subscription/checkPermission';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { useCallback, useEffect, useState } from 'react';

type UsePermissionResult = {
  allowed: boolean;
  effectiveTier: SubscriptionTier;
  loading: boolean;
  metadata?: Record<string, unknown>;
  reason?: string;
  upgradeTo?: SubscriptionTier;
  refresh: () => Promise<void>;
};

export function usePermission(
  feature: string,
  options?: { checkQuota?: boolean; skip?: boolean }
): UsePermissionResult {
  const { user, dbUser } = useAuth();
  const [loading, setLoading] = useState(!options?.skip);
  const [result, setResult] = useState<PermissionResult>(() => ({
    allowed: false,
    effectiveTier: resolveClientEffectiveTier(dbUser),
  }));

  const refresh = useCallback(async () => {
    if (options?.skip || !user?.id) {
      setLoading(false);
      setResult({
        allowed: false,
        effectiveTier: resolveClientEffectiveTier(dbUser),
      });
      return;
    }
    setLoading(true);
    const next = await checkPermission(user.id, feature, { checkQuota: options?.checkQuota });
    setResult(next);
    setLoading(false);
  }, [user?.id, feature, options?.checkQuota, options?.skip, dbUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    allowed: result.allowed,
    effectiveTier: result.effectiveTier,
    loading,
    metadata: result.metadata,
    reason: result.reason,
    upgradeTo: result.upgradeTo,
    refresh,
  };
}
