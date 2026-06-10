/**
 * In-memory draft for create-plan wizard + auto-save to AsyncStorage.
 */
import type { PlanDraft, PlanVisibility } from '@/types/planDraft';
import {
  clearPlanDraftStorage,
  loadPlanDraftFromStorage,
  savePlanDraftToStorage,
} from '@/lib/plans/planDraftStorage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type { PlanDraft, PlanVisibility } from '@/types/planDraft';

function defaultScheduled(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

const emptyDraft = (): PlanDraft => ({
  title: '',
  description: '',
  locationLabel: '',
  latitude: null,
  longitude: null,
  scheduledAt: defaultScheduled(),
  startingPrice: '',
  visibility: 'public',
  meetTypeId: null,
  isPaid: true,
  escrowPattern: 'A',
  hostContributionBps: 5000,
  isMoodPlan: false,
  moodExpiresAt: null,
  budgetTier: null,
  durationMinutes: null,
  moodType: null,
  moodWindow: 'now',
  moodCustomStart: null,
  moodCustomEnd: null,
  moodListingHours: 3,
  spotlightBoost: false,
  isGroupPlan: false,
  maxGuests: 4,
  maxFreeGuests: null,
  maxPremiumGuests: null,
  multiCity: false,
  cityIds: [],
});

type Ctx = {
  draft: PlanDraft;
  setDraft: React.Dispatch<React.SetStateAction<PlanDraft>>;
  /** Clears draft + AsyncStorage; clears pending auto-save; invalidates in-flight hydration. */
  reset: () => Promise<void>;
};

const PlanDraftContext = createContext<Ctx | null>(null);

export function PlanDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<PlanDraft>(() => emptyDraft());
  const [storageReady, setStorageReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Increment to ignore AsyncStorage hydration that finishes after `reset()` or unmount. */
  const hydrateGeneration = useRef(0);

  useEffect(() => {
    const myGeneration = ++hydrateGeneration.current;
    let cancelled = false;
    void (async () => {
      const saved = await loadPlanDraftFromStorage();
      if (cancelled || myGeneration !== hydrateGeneration.current) return;
      if (saved) setDraft(saved);
      setStorageReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void savePlanDraftToStorage(draft);
    }, 450);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, storageReady]);

  const reset = useCallback(async () => {
    hydrateGeneration.current += 1;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await clearPlanDraftStorage();
    setDraft(emptyDraft());
    setStorageReady(true);
  }, []);

  const value = useMemo(() => ({ draft, setDraft, reset }), [draft, reset]);
  return <PlanDraftContext.Provider value={value}>{children}</PlanDraftContext.Provider>;
}

export function usePlanDraft() {
  const c = useContext(PlanDraftContext);
  if (!c) throw new Error('usePlanDraft must be used within PlanDraftProvider');
  return c;
}
