import type { MatchMakerGate, MatchMakerGateState } from '@/lib/matchmaker/types';

export type MatchMakerLifecycleMeta = {
  reflectionDay?: number;
  healingDay?: number;
  daysUntilPool?: number;
  reflectionStartedAt?: string;
  sourceConnectionId?: string;
  cooldownReason?: string;
};

export function parseLifecycleMeta(raw: Record<string, unknown>): MatchMakerLifecycleMeta {
  return {
    reflectionDay:
      typeof raw.reflection_day === 'number'
        ? raw.reflection_day
        : typeof raw.reflection_day === 'string'
          ? Number(raw.reflection_day)
          : undefined,
    healingDay:
      typeof raw.healing_day === 'number'
        ? raw.healing_day
        : typeof raw.healing_day === 'string'
          ? Number(raw.healing_day)
          : undefined,
    daysUntilPool:
      typeof raw.days_until_pool === 'number'
        ? raw.days_until_pool
        : typeof raw.days_until_pool === 'string'
          ? Number(raw.days_until_pool)
          : undefined,
    reflectionStartedAt:
      typeof raw.reflection_started_at === 'string' ? raw.reflection_started_at : undefined,
    sourceConnectionId:
      typeof raw.source_connection_id === 'string' ? raw.source_connection_id : undefined,
    cooldownReason:
      typeof raw.cooldown_reason === 'string' ? raw.cooldown_reason : undefined,
  };
}

export function normalizeGateFromRpc(raw: Record<string, unknown> | null): MatchMakerGateState {
  const gateRaw = raw?.gate;
  let gate = (typeof gateRaw === 'string' ? gateRaw : 'subscription') as MatchMakerGate;
  if (gate === 'pool') gate = 'open';

  const lifecycle = parseLifecycleMeta(raw ?? {});

  return {
    gate,
    connection_id: typeof raw?.connection_id === 'string' ? raw.connection_id : undefined,
    connection_status:
      typeof raw?.connection_status === 'string' ? raw.connection_status : undefined,
    cooldown_until: typeof raw?.cooldown_until === 'string' ? raw.cooldown_until : undefined,
    suspension_until: typeof raw?.suspension_until === 'string' ? raw.suspension_until : undefined,
    reason: typeof raw?.reason === 'string' ? raw.reason : undefined,
    ...lifecycle,
  };
}

export function daysUntilIso(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export function subscriptionLapseDaysRemaining(pausedAt: string | null | undefined): number | null {
  if (!pausedAt) return null;
  const deadline = new Date(pausedAt).getTime() + 14 * 86400000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 86400000));
}
