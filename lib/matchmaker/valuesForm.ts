import { supabase } from '@/lib/supabase';

export const COMMUNICATION_STYLE_OPTIONS = [
  { value: 'daily', label: 'Daily contact' },
  { value: 'few_times_week', label: 'A few times a week' },
  { value: 'flexible', label: 'Flexible' },
] as const;

export type ValuesFormFocus = 'communication' | 'faith' | 'family' | 'pace' | 'dealbreakers';

export const VALUES_FOCUS_TO_STEP: Record<Exclude<ValuesFormFocus, 'communication'>, number> = {
  faith: 0,
  family: 1,
  pace: 2,
  dealbreakers: 3,
};

export type DealbreakersDraft = {
  faith: boolean;
  family: boolean;
  location: boolean;
  locationKm: number;
  age: boolean;
  ageMin: number;
  ageMax: number;
  other: boolean;
};

export type MatchMakerValuesFormState = {
  faith: 'yes' | 'open' | 'skip' | null;
  faithType: string | null;
  otherFaithText: string;
  familyGoals: string | null;
  pace: string | null;
  communicationStyle: string | null;
  dealbreakers: DealbreakersDraft;
  otherDealbreakers: string[];
  hasExistingValues: boolean;
};

export const EMPTY_DEALBREAKERS: DealbreakersDraft = {
  faith: false,
  family: false,
  location: false,
  locationKm: 25,
  age: false,
  ageMin: 22,
  ageMax: 40,
  other: false,
};

function parseFaithFromDb(faith: string | null | undefined): Pick<
  MatchMakerValuesFormState,
  'faith' | 'faithType' | 'otherFaithText'
> {
  if (!faith) {
    return { faith: null, faithType: null, otherFaithText: '' };
  }
  if (faith === 'prefer_not_to_say') {
    return { faith: 'skip', faithType: null, otherFaithText: '' };
  }
  if (faith.startsWith('other:')) {
    return { faith: 'yes', faithType: 'other', otherFaithText: faith.slice('other:'.length) };
  }
  if (faith === 'Christianity' || faith === 'Islam' || faith === 'Prefer not to specify') {
    return { faith: 'yes', faithType: faith, otherFaithText: '' };
  }
  return { faith: 'yes', faithType: 'other', otherFaithText: faith };
}

function parseDealbreakersFromDb(raw: unknown): Pick<
  MatchMakerValuesFormState,
  'dealbreakers' | 'otherDealbreakers'
> {
  const base = { ...EMPTY_DEALBREAKERS };
  if (!raw || typeof raw !== 'object') {
    return { dealbreakers: base, otherDealbreakers: [] };
  }
  const db = raw as Record<string, unknown>;
  const otherList = Array.isArray(db.other)
    ? db.other.filter((t): t is string => typeof t === 'string')
    : [];
  return {
    dealbreakers: {
      faith: Boolean(db.faith_alignment),
      family: Boolean(db.family_goals_align || db.family_goals_alignment),
      location: Boolean(db.within_distance),
      locationKm:
        typeof db.max_distance_km === 'number'
          ? db.max_distance_km
          : typeof db.max_distance_km === 'string'
            ? Number(db.max_distance_km) || 25
            : 25,
      age: Boolean(db.within_age_range),
      ageMin:
        typeof db.age_min === 'number'
          ? db.age_min
          : typeof db.age_min === 'string'
            ? Number(db.age_min) || 22
            : 22,
      ageMax:
        typeof db.age_max === 'number'
          ? db.age_max
          : typeof db.age_max === 'string'
            ? Number(db.age_max) || 40
            : 40,
      other: otherList.length > 0 || Boolean(db.other_enabled),
    },
    otherDealbreakers: otherList,
  };
}

export async function loadMatchMakerValuesForm(userId: string): Promise<MatchMakerValuesFormState> {
  const [{ data: profile, error: profileErr }, { data: values, error: valuesErr }] =
    await Promise.all([
      supabase.from('profiles').select('communication_style').eq('user_id', userId).maybeSingle(),
      supabase
        .from('matchmaker_values')
        .select('faith, family_goals, pace_preference, communication_frequency, dealbreakers')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (profileErr) throw profileErr;
  if (valuesErr) throw valuesErr;

  const hasExistingValues = values != null;
  let faithParsed = parseFaithFromDb(values?.faith ?? null);
  const dbParsed = parseDealbreakersFromDb(values?.dealbreakers);

  const communicationStyle =
    profile?.communication_style ?? values?.communication_frequency ?? null;

  if (!hasExistingValues) {
    return {
      ...faithParsed,
      familyGoals: null,
      pace: null,
      communicationStyle,
      ...dbParsed,
      hasExistingValues: false,
    };
  }

  if (values?.faith == null && values?.family_goals) {
    faithParsed = { ...faithParsed, faith: 'open' };
  }

  return {
    ...faithParsed,
    familyGoals: values?.family_goals ?? null,
    pace: values?.pace_preference ?? null,
    communicationStyle,
    ...dbParsed,
    hasExistingValues: true,
  };
}

export function buildFaithDbValue(
  faith: 'yes' | 'open' | 'skip' | null,
  faithType: string | null,
  otherFaithText: string
): string | null {
  if (faith === 'yes' && faithType) {
    return faithType === 'other' ? `other:${otherFaithText.trim()}` : faithType;
  }
  if (faith === 'skip') return 'prefer_not_to_say';
  if (faith === 'open') return null;
  return null;
}

export function buildDealbreakersDbPayload(
  dealbreakers: DealbreakersDraft,
  otherDealbreakers: string[]
): Record<string, unknown> {
  return {
    faith_alignment: dealbreakers.faith,
    family_goals_align: dealbreakers.family,
    within_distance: dealbreakers.location,
    within_age_range: dealbreakers.age,
    max_distance_km: dealbreakers.location ? dealbreakers.locationKm : undefined,
    age_min: dealbreakers.age ? dealbreakers.ageMin : undefined,
    age_max: dealbreakers.age ? dealbreakers.ageMax : undefined,
    other: dealbreakers.other ? otherDealbreakers : [],
  };
}
