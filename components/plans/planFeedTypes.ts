import type { DbMeetType, DbPlan, DbProfile, UserVerification } from '@/types/database';

/** One row in the Nearby Plans feed with creator profile + verification. */
export type PlanFeedRow = DbPlan & {
  /** Joined from `meet_types` in feed query; not a DB column on `plans`. */
  meetType?: DbMeetType | null;
  creatorProfile: Pick<
    DbProfile,
    | 'user_id'
    | 'display_name'
    | 'avatar_url'
    | 'primary_photo_url'
    | 'birth_date'
    | 'verified_badge'
    | 'subscription_badge'
    | 'ai_trust_score'
    | 'photo_urls'
    | 'bio'
    | 'onboarding_status'
    | 'preferences'
    | 'spotlight_until'
    | 'masked_activity_enabled'
  > | null;
  /** Always null in client feed — `users.verification_status` is not readable for other users under RLS. Use `verified_badge` on profile. */
  creatorVerification: UserVerification | null;
};
