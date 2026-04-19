/**
 * Manual types for LinkUp MVP — mirror of supabase/migrations/*.sql enums & tables.
 * Regenerate with `supabase gen types` when CLI is wired.
 */
export type AccountStatus = 'active' | 'restricted' | 'suspended';
export type UserVerification = 'unverified' | 'pending' | 'verified' | 'rejected';
export type PlanStatus =
  | 'draft'
  | 'negotiating'
  | 'agreed'
  | 'awaiting_payment'
  | 'active'
  | 'completed'
  | 'cancelled';
export type OfferStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'superseded'
  | 'expired';
export type EscrowStatus =
  | 'pending_funding'
  | 'funded'
  | 'released'
  | 'disputed'
  | 'refunded'
  | 'cancelled';
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type VerificationRequestStatus =
  | 'pending'
  | 'ai_pass'
  | 'ai_flag'
  | 'admin_approved'
  | 'admin_rejected'
  | 'more_info';

export interface ProfilePreferences {
  languages?: string[];
  interests?: string[];
  meeting_intent?: 'friendship' | 'dating' | 'activity' | 'networking';
  /** Hinge-style prompt answers */
  prompt_answers?: { prompt_id: string; prompt: string; answer: string }[];
  show_me?: 'everyone' | 'women' | 'men';
  self_gender?: string;
  distance_unit?: 'km' | 'mi';
  safety_tips_acknowledged?: boolean;
  profile_draft?: boolean;
  ai_flags?: unknown;
  /**
   * Last onboarding text screening (trust heuristics). Non-blocking; separate from KYC.
   * Policy escalation to manual review would be a separate admin pipeline, not implemented here.
   */
  initial_profile_screening?: {
    trust_score: number;
    flags: string[];
    checked_at: string;
    source: 'onboarding_save' | 'onboarding_finalize';
  };
  /** 0-based index of the onboarding step to show when `onboarding_status === 'pending'` (resume after sign-in). */
  onboarding_step?: number;
  /** Premium feed filters (Premium). */
  feed_filters?: {
    maxPriceCents?: number | null;
    verifiedHostsOnly?: boolean;
    maxDistanceKm?: number | null;
  };
  /** Travel browse location override (Premium). */
  travel_mode?: {
    label: string;
    latitude: number;
    longitude: number;
  } | null;
  notifications?: {
    push?: boolean;
    email?: boolean;
  };
  /** Set by paystack-webhook-premium after successful charge (idempotency). */
  paystack_last_premium_reference?: string;
  expo_push_token?: string;
  expo_push_token_updated_at?: string;
  /** Presence & privacy — fairness: hiding all activity hides others’ status in the app. */
  visibility?: {
    show_online_status?: boolean;
    show_last_seen?: boolean;
    read_receipts?: boolean;
    share_typing_indicator?: boolean;
  };
  [key: string]: unknown;
}

/** One row per user — updated by client heartbeat + typing signals. */
export interface DbUserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  typing_conversation_id: string | null;
  typing_updated_at: string | null;
  updated_at: string;
}

export type SubscriptionStatus = 'none' | 'active' | 'expired';

export interface DbUser {
  id: string;
  email: string | null;
  account_status: AccountStatus;
  verification_status: UserVerification;
  premium_until: string | null;
  /** Present after migration `20240415000000_premium_engagement_blocks`; treat missing as `none`. */
  subscription_status?: SubscriptionStatus;
  boost_credits: number;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  birth_date?: string | null;
  photo_urls?: string[] | null;
  gender?: string | null;
  onboarding_status?: 'pending' | 'complete' | 'skipped';
  preferences: ProfilePreferences;
  age_min: number | null;
  age_max: number | null;
  radius_km: number | null;
  latitude: number | null;
  longitude: number | null;
  is_profile_public: boolean;
  ai_trust_score: number | null;
  /** Public “verified host” flag; kept in sync with `users.verification_status` via DB trigger — prefer updating the request/user row, not this field directly. */
  verified_badge: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPlan {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: string | null;
  starting_price_cents: number | null;
  currency: string;
  status: PlanStatus;
  visibility: 'public' | 'radius' | 'friends';
  boosted_until: string | null;
  scheduled_at: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  accepted_offer_id: string | null;
  /** Snapshot at accept — PL6a confirmation uses these. */
  agreed_price_cents: number | null;
  agreed_scheduled_at: string | null;
  agreed_location: string | null;
  agreed_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ModerationStatus = 'pending' | 'clean' | 'flagged' | 'blocked';

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  text: string | null;
  media_id: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface DbPlanOffer {
  id: string;
  plan_id: string;
  bidder_id: string;
  amount_cents: number | null;
  message: string | null;
  status: OfferStatus;
  round: number;
  expires_at: string | null;
  proposed_scheduled_at: string | null;
  created_at: string;
}

export interface DbPlanEngagement {
  id: string;
  plan_id: string;
  user_id: string;
  kind: 'view' | 'save';
  created_at: string;
}

export interface DbVerificationRequest {
  id: string;
  user_id: string;
  status: VerificationRequestStatus;
  id_document_path: string | null;
  selfie_video_path: string | null;
  /** KYC document kind: national_id | passport | drivers_license | voters_card */
  document_type: string | null;
  rejection_reason: string | null;
  country_code: string | null;
  consent_at: string | null;
  ai_analysis: Record<string, unknown> | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEscrowTransaction {
  id: string;
  plan_id: string;
  payer_id: string;
  payee_id: string;
  amount_cents: number;
  currency: string;
  paystack_reference: string | null;
  status: EscrowStatus;
  metadata: Record<string, unknown> | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEscrowDispute {
  id: string;
  escrow_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  admin_resolution: string | null;
  support_ticket_id: string | null;
  detail: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DbSupportTicket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: string;
  created_at: string;
  updated_at: string;
}

export type NotificationPriority = 'high' | 'medium' | 'low';

/** `type` values — extend as triggers / Edge Functions emit new kinds. */
export type NotificationEventType =
  | 'offer_new'
  | 'offer_counter'
  | 'mutual_agreement'
  | 'premium_activated'
  | 'escrow_funded'
  | 'escrow_status'
  | 'plan_reminder'
  | 'completion_release'
  | 'cancel_chargeback'
  | 'message'
  | 'report_submitted'
  | 'dispute_opened'
  | 'kyc_submitted'
  | 'kyc_decision'
  | 'account_restriction'
  | string;

/** JSON `data` for deep links — keep push payloads generic (no amounts). */
export interface NotificationPayload {
  href?: string;
  planId?: string;
  offerId?: string;
  escrowId?: string;
  chatId?: string;
  disputeId?: string;
  /** Optional mirror of row `type` for push payloads. */
  type?: string;
  [key: string]: unknown;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: NotificationEventType;
  title: string;
  body: string;
  data: NotificationPayload;
  is_read: boolean;
  priority: NotificationPriority;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
}
