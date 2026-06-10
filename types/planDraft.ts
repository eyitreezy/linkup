import type { BudgetTier, EscrowPattern } from '@/types/database';
import type { MoodListingHours, MoodWindowPreset } from '@/lib/plans/moodPlanComputations';

export type PlanVisibility = 'public' | 'radius' | 'friends' | 'premium';

export type PlanDraft = {
  title: string;
  description: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Date | null;
  startingPrice: string;
  visibility: PlanVisibility;
  meetTypeId: string | null;
  isPaid: boolean;
  escrowPattern: EscrowPattern | null;
  /** Pattern B — host share in basis points (0–10000). */
  hostContributionBps: number;
  isMoodPlan: boolean;
  moodExpiresAt: Date | null;
  budgetTier: BudgetTier | null;
  durationMinutes: number | null;
  moodType: string | null;
  moodWindow: MoodWindowPreset;
  moodCustomStart: Date | null;
  moodCustomEnd: Date | null;
  moodListingHours: MoodListingHours;
  /** Premium: start with boost-style visibility */
  spotlightBoost: boolean;
  /** Group meet type */
  isGroupPlan: boolean;
  maxGuests: number;
  maxFreeGuests: number | null;
  maxPremiumGuests: number | null;
  multiCity: boolean;
  cityIds: string[];
};
