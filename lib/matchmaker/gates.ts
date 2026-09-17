import { supabase } from '@/lib/supabase';
import type { MatchMakerGate, MatchMakerGateState } from '@/lib/matchmaker/types';

export const MATCHMAKER_GATED_MODAL: MatchMakerGate[] = ['subscription', 'kyc', 'cooldown', 'suspended'];

export function normalizeMatchMakerGateState(raw: Record<string, unknown> | null): MatchMakerGateState {
  const gateRaw = raw?.gate;
  let gate = (typeof gateRaw === 'string' ? gateRaw : 'subscription') as MatchMakerGate;
  if (gate === 'pool') gate = 'open';

  return {
    gate,
    connection_id: typeof raw?.connection_id === 'string' ? raw.connection_id : undefined,
    connection_status: typeof raw?.connection_status === 'string' ? raw.connection_status : undefined,
    cooldown_until: typeof raw?.cooldown_until === 'string' ? raw.cooldown_until : undefined,
    suspension_until: typeof raw?.suspension_until === 'string' ? raw.suspension_until : undefined,
    reason: typeof raw?.reason === 'string' ? raw.reason : undefined,
  };
}

export async function fetchMatchMakerGateState(): Promise<MatchMakerGateState> {
  const { data, error } = await supabase.rpc('matchmaker_get_gate_state');
  if (error) throw error;
  return normalizeMatchMakerGateState((data ?? { gate: 'subscription' }) as Record<string, unknown>);
}

/** Redirect paths for onboarding / connection flows only — not gate modals. */
export function gateRouteFor(state: MatchMakerGateState): string | null {
  switch (state.gate) {
    case 'intent':
      return '/matchmaker/declare';
    case 'values':
      return '/matchmaker/values';
    case 'reflection':
      return '/matchmaker/reflect';
    case 'healing':
      return '/matchmaker/heal';
    case 'reentry':
      return '/matchmaker/reentry';
    case 'connection':
      return state.connection_id ? `/matchmaker/connection/${state.connection_id}` : null;
    default:
      return null;
  }
}

export function daysUntilGate(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
