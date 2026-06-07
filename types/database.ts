/**
 * Manual types for LinkUp MVP — mirror of supabase/migrations/*.sql enums & tables.
 * Regenerate with `supabase gen types` when CLI is wired.
 */
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned';
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
  | 'active'
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
  /** Step 1 — user confirmed 18+ during onboarding. */
  adult_confirmed?: boolean;
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
    minPriceCents?: number | null;
    maxPriceCents?: number | null;
    verifiedHostsOnly?: boolean;
    hostPresence?: 'all' | 'online' | 'offline';
    maxDistanceKm?: number | null;
    clientFiltersActive?: boolean;
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
  /** 1 = standard KYC; 2 = enhanced (e.g. BVN) for Pattern C / high limits */
  kyc_tier?: 1 | 2;
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
  /** Main profile photo — synced with avatar_url and first in photo_urls when set. */
  primary_photo_url?: string | null;
  birth_date?: string | null;
  photo_urls?: string[] | null;
  gender?: string | null;
  onboarding_status?: 'pending' | 'complete' | 'skipped';
  preferences: ProfilePreferences;
  /** Top-level column (mirrors preferences.expo_push_token) — visible in Supabase Table Editor. */
  expo_push_token?: string | null;
  expo_push_token_updated_at?: string | null;
  age_min: number | null;
  age_max: number | null;
  radius_km: number | null;
  latitude: number | null;
  longitude: number | null;
  /** City / area label from onboarding location search or GPS. */
  location_label: string | null;
  is_profile_public: boolean;
  ai_trust_score: number | null;
  /** Public “verified host” flag; kept in sync with `users.verification_status` via DB trigger — prefer updating the request/user row, not this field directly. */
  verified_badge: boolean;
  created_at: string;
  updated_at: string;
}

export type EscrowPattern = 'A' | 'B' | 'C';
export type BudgetTier = 'low' | 'mid' | 'high';

export interface DbMeetType {
  id: string;
  name: string;
  slug: string;
  default_duration_minutes: number;
  allows_escrow: boolean;
  allowed_patterns: string[];
  default_pattern: EscrowPattern | null;
  is_restricted: boolean;
  supports_mood: boolean;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  /** Set when the row is created by a user (custom type); catalog seeds use null. */
  created_by?: string | null;
}

export interface DbPlan {
  id: string;
  creator_id: string;
  meet_type_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  starting_price_cents: number | null;
  currency: string;
  status: PlanStatus;
  visibility: 'public' | 'radius' | 'friends';
  /** Hidden from discovery feeds when moderation escalates */
  is_suppressed?: boolean;
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
  is_paid: boolean;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  budget_tier: BudgetTier | null;
  escrow_pattern: EscrowPattern | null;
  host_contribution_bps: number | null;
  is_mood_plan: boolean;
  /** Mood TTL processed — hidden from public discovery (RLS + feeds). */
  is_expired?: boolean;
  /** Reserved — default true. */
  creator_can_manage?: boolean;
  /** Creator archived — hidden from discover; visible in Plan management. */
  archived_at?: string | null;
  mood_expires_at: string | null;
  /** UX mood category for discover */
  mood_type?: string | null;
  mood_start_time?: string | null;
  mood_end_time?: string | null;
  auto_expiry_at?: string | null;
  urgency_level?: string | null;
  negotiation_expires_at?: string | null;
  spotlight_enabled?: boolean;
  duration_minutes: number | null;
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
  proposed_location: string | null;
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

export type VerificationEventType =
  | 'submitted'
  | 'vendor_update'
  | 'status_changed'
  | 'admin_review'
  | 'approved'
  | 'rejected';

export interface DbVerificationEvent {
  id: string;
  verification_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ModerationFlagType = 'spam' | 'abuse' | 'scam' | 'explicit' | 'other';
export type ModerationSeverity = 'low' | 'medium' | 'high';
export type ModerationAction = 'none' | 'hidden' | 'warned' | 'banned';

export interface DbModerationLog {
  id: string;
  user_id: string;
  content_type: 'message' | 'plan' | 'profile';
  content_id: string;
  flag_type: ModerationFlagType;
  severity: ModerationSeverity;
  ai_score: number | null;
  action_taken: ModerationAction;
  created_at: string;
}

export type ReportStatus = 'pending' | 'reviewed' | 'resolved';
export type ReportContentType = 'message' | 'plan' | 'profile' | 'user';

export interface DbReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  content_type: ReportContentType;
  content_id: string | null;
  reason: string;
  note: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface DbEscrowTransaction {
  id: string;
  plan_id: string;
  payer_id: string;
  payee_id: string;
  host_id: string | null;
  guest_id: string | null;
  escrow_pattern: EscrowPattern | null;
  host_share_cents: number | null;
  guest_share_cents: number | null;
  funding_deadline: string | null;
  platform_fee_cents: number | null;
  host_funded_at: string | null;
  guest_funded_at: string | null;
  amount_cents: number;
  currency: string;
  paystack_reference: string | null;
  status: EscrowStatus;
  metadata: Record<string, unknown> | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PlanDisputeCategory =
  | 'payment_issue'
  | 'no_show'
  | 'misconduct'
  | 'scam'
  | 'other';

export type PlanDisputeStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export type PlanDisputeResolution = 'refund' | 'partial' | 'none';

export interface DbDispute {
  id: string;
  plan_id: string;
  reporter_id: string;
  reported_user_id: string;
  category: PlanDisputeCategory;
  status: PlanDisputeStatus;
  resolution: PlanDisputeResolution | null;
  reporter_note: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type DisputeEvidenceType = 'video' | 'image' | 'text';

export interface DbDisputeEvidence {
  id: string;
  dispute_id: string;
  type: DisputeEvidenceType;
  file_path: string | null;
  text_body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  purge_after: string | null;
}

export type UserStrikeStatus = 'active' | 'suspended' | 'banned';

export interface DbUserStrikes {
  user_id: string;
  strike_count: number;
  last_strike_at: string | null;
  status: UserStrikeStatus;
  suspended_until: string | null;
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
  | 'payment_reminder'
  | 'completion_release'
  | 'cancel_chargeback'
  | 'message'
  | 'report_submitted'
  | 'moderation_flagged'
  | 'verification_submitted'
  | 'verification_updated'
  | 'dispute_opened'
  | 'dispute_created'
  | 'dispute_updated'
  | 'dispute_resolved'
  | 'strike_added'
  | 'user_suspended'
  | 'user_banned'
  | 'kyc_submitted'
  | 'kyc_decision'
  | 'account_restriction'
  | 'agreement_confirmed'
  | 'agreement_update'
  | 'plan_cancelled'
  | 'wallet_updated'
  | 'credit_issued'
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

/** Both parties must confirm before `agreed` → `active` / `awaiting_payment` (server trigger). */
export interface DbAgreementConfirmation {
  id: string;
  plan_id: string;
  user_id: string;
  confirmed_at: string;
}

export type SubscriptionPlan = 'basic' | 'premium';
export type SubscriptionRowStatus = 'active' | 'cancelled' | 'expired';

export interface DbSubscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionRowStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export type CancellationRole = 'host' | 'guest';
export type CancellationKind = 'early' | 'late' | 'no_show' | 'mutual';

export interface DbCancellation {
  id: string;
  plan_id: string;
  user_id: string;
  role: CancellationRole;
  cancel_type: CancellationKind;
  refund_amount: number;
  fee_amount: number;
  goodwill_credit_amount: number;
  created_at: string;
}

export type GoodwillSource = 'cancellation' | 'dispute_resolution' | 'promo';

export interface DbGoodwillCredit {
  id: string;
  user_id: string;
  amount: number;
  source: GoodwillSource;
  expires_at: string;
  used_amount: number;
  created_at: string;
}

export type WalletLedgerType = 'credit' | 'debit';
export type WalletLedgerSource = 'escrow_release' | 'goodwill' | 'refund' | 'fee' | 'adjustment';

export interface DbWalletLedgerRow {
  id: string;
  user_id: string;
  type: WalletLedgerType;
  source: WalletLedgerSource;
  amount: number;
  reference_id: string | null;
  created_at: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface DbWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: WithdrawalStatus;
  created_at: string;
}

export type FinancialEventType =
  | 'escrow_created'
  | 'escrow_funded'
  | 'escrow_released'
  | 'escrow_refunded'
  | 'escrow_disputed'
  | 'wallet_credit'
  | 'wallet_debit'
  | 'goodwill_issued'
  | 'cancellation'
  | 'reconciliation_note';

export interface DbFinancialEvent {
  id: string;
  user_id: string | null;
  event_type: FinancialEventType;
  amount: number;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ReconciliationRunStatus = 'ok' | 'mismatch' | 'error' | 'stub';

export interface DbReconciliationLog {
  id: string;
  date_run: string;
  status: ReconciliationRunStatus;
  discrepancies: unknown;
  created_at: string;
}

export interface DbProfileView {
  id: string;
  viewer_id: string;
  viewed_user_id: string;
  created_at: string;
}
