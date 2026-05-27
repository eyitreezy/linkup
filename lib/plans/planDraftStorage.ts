import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BudgetTier, EscrowPattern } from '@/types/database';
import type { PlanDraft, PlanVisibility } from '@/types/planDraft';
import type { MoodListingHours, MoodWindowPreset } from '@/lib/plans/moodPlanComputations';

/** Current draft key — bump when you need a one-time discard of all cached drafts (see LEGACY_STORAGE_KEYS). */
const STORAGE_KEY = 'linkup_plan_draft_v3';

const LEGACY_STORAGE_KEYS = ['linkup_plan_draft_v2'] as const;

type Serialized = {
  title: string;
  description: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: string | null;
  startingPrice: string;
  visibility: PlanVisibility;
  meetTypeId: string | null;
  isPaid: boolean;
  escrowPattern: EscrowPattern | null;
  hostContributionBps: number;
  isMoodPlan: boolean;
  moodExpiresAt: string | null;
  budgetTier: BudgetTier | null;
  durationMinutes: number | null;
  moodType: string | null;
  moodWindow: MoodWindowPreset;
  moodCustomStart: string | null;
  moodCustomEnd: string | null;
  moodListingHours: MoodListingHours;
  spotlightBoost: boolean;
};

export function serializePlanDraft(d: PlanDraft): string {
  const payload: Serialized = {
    title: d.title,
    description: d.description,
    locationLabel: d.locationLabel,
    latitude: d.latitude,
    longitude: d.longitude,
    scheduledAt: d.scheduledAt?.toISOString() ?? null,
    startingPrice: d.startingPrice,
    visibility: d.visibility,
    meetTypeId: d.meetTypeId,
    isPaid: d.isPaid,
    escrowPattern: d.escrowPattern,
    hostContributionBps: d.hostContributionBps,
    isMoodPlan: d.isMoodPlan,
    moodExpiresAt: d.moodExpiresAt?.toISOString() ?? null,
    budgetTier: d.budgetTier,
    durationMinutes: d.durationMinutes,
    moodType: d.moodType,
    moodWindow: d.moodWindow,
    moodCustomStart: d.moodCustomStart?.toISOString() ?? null,
    moodCustomEnd: d.moodCustomEnd?.toISOString() ?? null,
    moodListingHours: d.moodListingHours,
    spotlightBoost: d.spotlightBoost,
  };
  return JSON.stringify(payload);
}

export function deserializePlanDraft(raw: string): PlanDraft | null {
  try {
    const p = JSON.parse(raw) as Serialized;
    return {
      title: p.title ?? '',
      description: p.description ?? '',
      locationLabel: p.locationLabel ?? '',
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
      startingPrice: p.startingPrice ?? '',
      visibility: p.visibility ?? 'public',
      meetTypeId: p.meetTypeId ?? null,
      isPaid: !!p.isPaid,
      escrowPattern: p.escrowPattern ?? null,
      hostContributionBps: p.hostContributionBps ?? 5000,
      isMoodPlan: !!p.isMoodPlan,
      moodExpiresAt: p.moodExpiresAt ? new Date(p.moodExpiresAt) : null,
      budgetTier: p.budgetTier ?? null,
      durationMinutes: p.durationMinutes ?? null,
      moodType: p.moodType ?? null,
      moodWindow: p.moodWindow ?? 'now',
      moodCustomStart: p.moodCustomStart ? new Date(p.moodCustomStart) : null,
      moodCustomEnd: p.moodCustomEnd ? new Date(p.moodCustomEnd) : null,
      moodListingHours: (p.moodListingHours as MoodListingHours) ?? 3,
      spotlightBoost: !!p.spotlightBoost,
    };
  } catch {
    return null;
  }
}

export async function loadPlanDraftFromStorage(): Promise<PlanDraft | null> {
  for (const k of LEGACY_STORAGE_KEYS) {
    await AsyncStorage.removeItem(k);
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return deserializePlanDraft(raw);
}

export async function savePlanDraftToStorage(d: PlanDraft): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, serializePlanDraft(d));
}

export async function clearPlanDraftStorage(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
}
