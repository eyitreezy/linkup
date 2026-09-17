export type MatchMakerGate =
  | 'subscription'
  | 'kyc'
  | 'cooldown'
  | 'intent'
  | 'values'
  | 'reflection'
  | 'healing'
  | 'reentry'
  | 'connection'
  | 'pool';

export type MatchMakerGateState = {
  gate: MatchMakerGate;
  connection_id?: string;
  cooldown_until?: string;
  reason?: string;
};

export type MatchMakerPoolProfile = {
  user_id: string;
  display_name: string | null;
  birth_date: string | null;
  avatar_url: string | null;
  location_label: string | null;
  verified_badge: boolean;
  bio: string | null;
  interests: string[];
  communication_style: string | null;
  distance_km: number | null;
};

export type MatchMakerConnection = {
  id: string;
  status: string;
  connected_at: string;
  first_message_at: string | null;
  plan_unlock_at: string | null;
  first_plan_created_at: string | null;
  ended_at: string | null;
  user_a_id: string;
  user_b_id: string;
};
