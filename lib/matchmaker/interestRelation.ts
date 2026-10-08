import { supabase } from '@/lib/supabase';

/** Mirrors linkup-web `MatchMakerViewerState` from `matchmaker_get_member_interaction`. */
export type MatchMakerInterestRelationState =
  | 'none'
  | 'interest_sent'
  | 'passed'
  | 'matched'
  | 'self';

export type MatchMakerInterestRelation = {
  state: MatchMakerInterestRelationState;
  interestStatus: string | null;
  canExpress: boolean;
  canPass: boolean;
  connectionId?: string;
};

function normalizeRelationState(value: unknown): MatchMakerInterestRelationState {
  switch (value) {
    case 'interest_sent':
    case 'passed':
    case 'matched':
    case 'self':
      return value;
    default:
      return 'none';
  }
}

/** Uses linkup-web RPC: `matchmaker_get_member_interaction(p_member_user_id)`. */
export async function fetchMatchMakerInterestRelation(
  memberUserId: string
): Promise<MatchMakerInterestRelation> {
  const { data, error } = await supabase.rpc('matchmaker_get_member_interaction', {
    p_member_user_id: memberUserId,
  });
  if (error) throw error;

  const payload = (typeof data === 'string' ? JSON.parse(data) : data ?? {}) as Record<
    string,
    unknown
  >;

  const state = normalizeRelationState(payload.viewer_state);
  let connectionId: string | undefined;

  if (state === 'matched') {
    const viewerId = (await supabase.auth.getUser()).data.user?.id;
    if (viewerId) {
      const userA = viewerId < memberUserId ? viewerId : memberUserId;
      const userB = viewerId < memberUserId ? memberUserId : viewerId;
      const { data: conn } = await supabase
        .from('matchmaker_connections')
        .select('id')
        .eq('user_a_id', userA)
        .eq('user_b_id', userB)
        .in('status', ['active', 'paused'])
        .maybeSingle();
      connectionId = conn?.id;
    }
  }

  return {
    state,
    interestStatus:
      typeof payload.interest_status === 'string' ? payload.interest_status : null,
    canExpress: !!payload.can_express,
    canPass: !!payload.can_pass,
    connectionId,
  };
}

export function interestRelationLabel(state: MatchMakerInterestRelationState): string | null {
  switch (state) {
    case 'interest_sent':
      return 'Interest sent';
    case 'passed':
      return 'You passed on this profile';
    case 'matched':
      return 'Already connected';
    default:
      return null;
  }
}
