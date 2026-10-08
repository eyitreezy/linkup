import { normalizeGateFromRpc, daysUntilIso } from '@/lib/matchmaker/lifecycle';
import { supabase } from '@/lib/supabase';
import type { MatchMakerGate, MatchMakerGateState } from '@/lib/matchmaker/types';

export const MATCHMAKER_GATED_MODAL: MatchMakerGate[] = [
  'subscription',
  'kyc',
  'suspended',
  'gender_not_set',
];

export function normalizeMatchMakerGateState(raw: Record<string, unknown> | null): MatchMakerGateState {
  return normalizeGateFromRpc(raw);
}

export async function fetchMatchMakerGateState(): Promise<MatchMakerGateState> {
  const { data, error } = await supabase.rpc('matchmaker_get_gate_state');
  if (error) throw error;
  return normalizeMatchMakerGateState((data ?? { gate: 'subscription' }) as Record<string, unknown>);
}

export async function saveReflectionPeriod(text: string, skip: boolean): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_save_reflection_period', {
    p_text: text,
    p_skip: skip,
  });
  if (error) throw error;
}

export async function saveHealingAnswers(
  answers: Record<string, unknown>,
  opts: { complete?: boolean; skipAll?: boolean }
): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_save_healing_answers', {
    p_answers: answers,
    p_complete: opts.complete ?? false,
    p_skip_all: opts.skipAll ?? false,
  });
  if (error) throw error;
}

export async function enterMatchMakerPoolAfterReentry(): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_enter_matchmaker_pool');
  if (error) throw error;
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
  return daysUntilIso(iso);
}
