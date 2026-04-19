/**
 * In-memory draft for PL1 → PL2 create-plan wizard.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type PlanVisibility = 'public' | 'radius' | 'friends';

export type PlanDraft = {
  title: string;
  description: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Date | null;
  startingPrice: string;
  visibility: PlanVisibility;
};

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
});

type Ctx = {
  draft: PlanDraft;
  setDraft: React.Dispatch<React.SetStateAction<PlanDraft>>;
  reset: () => void;
};

const PlanDraftContext = createContext<Ctx | null>(null);

export function PlanDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft);
  const reset = useCallback(() => setDraft(emptyDraft()), []);
  const value = useMemo(() => ({ draft, setDraft, reset }), [draft, reset]);
  return <PlanDraftContext.Provider value={value}>{children}</PlanDraftContext.Provider>;
}

export function usePlanDraft() {
  const c = useContext(PlanDraftContext);
  if (!c) throw new Error('usePlanDraft must be used within PlanDraftProvider');
  return c;
}
