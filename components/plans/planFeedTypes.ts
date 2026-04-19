import type { DbPlan, DbProfile, UserVerification } from '@/types/database';

/** One row in the Nearby Plans feed with creator profile + verification. */
export type PlanFeedRow = DbPlan & {
  creatorProfile: Pick<
    DbProfile,
    | 'user_id'
    | 'display_name'
    | 'avatar_url'
    | 'verified_badge'
    | 'ai_trust_score'
    | 'photo_urls'
    | 'bio'
    | 'onboarding_status'
    | 'preferences'
  > | null;
  /** Always null in client feed — `users.verification_status` is not readable for other users under RLS. Use `verified_badge` on profile. */
  creatorVerification: UserVerification | null;
};
