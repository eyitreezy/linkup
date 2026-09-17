import { supabase } from '@/lib/supabase';
import type { MatchMakerGateState } from '@/lib/matchmaker/types';

export async function fetchMatchMakerGateState(): Promise<MatchMakerGateState> {
  const { data, error } = await supabase.rpc('matchmaker_get_gate_state');
  if (error) throw error;
  return (data ?? { gate: 'subscription' }) as MatchMakerGateState;
}

export function gateRouteFor(state: MatchMakerGateState): string {
  switch (state.gate) {
    case 'subscription':
      return '/matchmaker';
    case 'kyc':
      return '/matchmaker';
    case 'cooldown':
      return '/matchmaker/suspended';
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
      return `/matchmaker/connection/${state.connection_id}`;
    case 'pool':
    default:
      return '/matchmaker/pool';
  }
}
