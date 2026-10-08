export type MatchMakerGate =
  | 'subscription'
  | 'kyc'
  | 'cooldown'
  | 'suspended'
  | 'gender_not_set'
  | 'intent'
  | 'values'
  | 'reflection'
  | 'healing'
  | 'reentry'
  | 'connection'
  | 'pool'
  | 'open';

export type MatchMakerInterestStatus = 'pending' | 'accepted' | 'passed' | 'expired';

export type MatchMakerInterestItem = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  expressed_at: string;
  status: MatchMakerInterestStatus;
  expires_at: string;
  profile: MatchMakerPoolProfile;
};

export type MatchMakerInterestQueue = {
  sent: MatchMakerInterestItem[];
  received: MatchMakerInterestItem[];
};

export type MatchMakerGateState = {
  gate: MatchMakerGate;
  connection_id?: string;
  connection_status?: string;
  cooldown_until?: string;
  suspension_until?: string;
  reason?: string;
  reflectionDay?: number;
  healingDay?: number;
  daysUntilPool?: number;
  reflectionStartedAt?: string;
  sourceConnectionId?: string;
  cooldownReason?: string;
};

export type MatchMakerPoolEmptyReason =
  | 'gender_not_set'
  | 'dealbreakers_strict'
  | 'location_narrow'
  | 'genuinely_empty'
  | null;

export type MatchMakerPoolResult = {
  profiles: MatchMakerPoolProfile[];
  emptyReason: MatchMakerPoolEmptyReason;
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
  paused_at: string | null;
  user_a_id: string;
  user_b_id: string;
};
