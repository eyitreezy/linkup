/**
 * Client-side KYC wizard persistence (resume later).
 * Steps: K1 intro → K2 document → K3 ID → K4 liveness → K5 consent → K6 queue → K7 outcome.
 */
export type KycDocumentType = 'national_id' | 'passport' | 'drivers_license' | 'voters_card';

export type KycStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type KycDraftPersisted = {
  /** Draft format v2 includes documentType; v1 omitted it (see migrateKycDraft). */
  draftVersion?: 2;
  step: KycStepNumber;
  documentType: KycDocumentType | null;
  countryCode: string | null;
  /** Local file URIs — re-upload if still present when submitting */
  idImageUri: string | null;
  videoUri: string | null;
};

export const KYC_TOTAL_STEPS = 7;

export const KYC_COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'NG', label: 'Nigeria' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'GH', label: 'Ghana' },
  { code: 'KE', label: 'Kenya' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'IN', label: 'India' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'OTHER', label: 'Other' },
];

/** Map legacy drafts (no documentType, steps 1–4 pre-submit) to K2–K5. */
export function migrateKycDraft(raw: unknown): KycDraftPersisted | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<KycDraftPersisted> & { step?: number };
  if (typeof d.step !== 'number' || d.step < 1 || d.step > 7) return null;

  const base: KycDraftPersisted = {
    draftVersion: 2,
    step: d.step as KycStepNumber,
    documentType: d.documentType ?? null,
    countryCode: d.countryCode ?? null,
    idImageUri: d.idImageUri ?? null,
    videoUri: d.videoUri ?? null,
  };

  if (d.draftVersion === 2 || d.documentType != null) {
    return base;
  }

  const s = d.step;
  if (s <= 1) return { ...base, step: 1, documentType: null };
  if (s === 2) return { ...base, step: 2, documentType: null };
  if (s === 3) return { ...base, step: 4, documentType: 'national_id' };
  if (s === 4) return { ...base, step: 5, documentType: 'national_id' };
  return base;
}
