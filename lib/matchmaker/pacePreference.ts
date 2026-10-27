/** Gate 4 Step 3 — stored in `matchmaker_values.pace_preference`. */

export const PACE_PREFERENCE_STEP_TITLE = 'Pace Preference';

export const PACE_PREFERENCE_QUESTION = 'How long after connecting do you expect to meet?';

export const PACE_PREFERENCE_PRIVATE_LABEL = 'Private. Used for compatibility weighting only.';

export const PACE_PREFERENCE_OPTIONS = [
  {
    key: 'asap',
    label: 'As soon as the platform allows (7 day minimum)',
    db: 'asap_7_days',
  },
  {
    key: '1_2',
    label: '1 to 2 weeks',
    db: 'one_two_weeks',
  },
  {
    key: '2_3',
    label: '2 to 3 weeks',
    db: 'two_three_weeks',
  },
  {
    key: 'long',
    label: 'I take my time, 1 months or more',
    db: 'one_month_or_more',
  },
] as const;

export type PacePreferenceUiKey = (typeof PACE_PREFERENCE_OPTIONS)[number]['key'];

const PACE_DB_BY_UI: Record<PacePreferenceUiKey, string> = Object.fromEntries(
  PACE_PREFERENCE_OPTIONS.map((o) => [o.key, o.db])
) as Record<PacePreferenceUiKey, string>;

const PACE_UI_BY_DB: Record<string, PacePreferenceUiKey> = Object.fromEntries(
  PACE_PREFERENCE_OPTIONS.map((o) => [o.db, o.key])
);

/** Legacy values (pre–week-based Gate 4 copy). Not auto-mapped to new chips. */
export const LEGACY_PACE_DB_VALUES = [
  'platform_minimum',
  'asap_21_days',
  'one_two_months',
  'three_six_months',
  'six_plus_months',
] as const;

const LEGACY_PACE_LABELS: Record<(typeof LEGACY_PACE_DB_VALUES)[number], string> = {
  platform_minimum: 'As soon as the platform allows (21 days minimum)',
  asap_21_days: 'As soon as the platform allows (21 days minimum)',
  one_two_months: '1 to 2 months',
  three_six_months: '3 to 6 months',
  six_plus_months: 'I take my time, 6 months or more',
};

export function pacePreferenceDbFromUi(uiKey: string | null | undefined): string | null {
  if (!uiKey) return null;
  return PACE_DB_BY_UI[uiKey as PacePreferenceUiKey] ?? null;
}

export function parsePacePreferenceUiFromDb(
  pacePreference: string | null | undefined
): PacePreferenceUiKey | null {
  if (!pacePreference) return null;
  return PACE_UI_BY_DB[pacePreference] ?? null;
}

export function pacePreferenceDisplayLabel(pacePreference: string | null | undefined): string {
  if (!pacePreference) return 'Not set';
  const uiKey = PACE_UI_BY_DB[pacePreference];
  if (uiKey) {
    return PACE_PREFERENCE_OPTIONS.find((o) => o.key === uiKey)?.label ?? 'Not set';
  }
  if (pacePreference in LEGACY_PACE_LABELS) {
    return LEGACY_PACE_LABELS[pacePreference as keyof typeof LEGACY_PACE_LABELS];
  }
  return 'Not set';
}
