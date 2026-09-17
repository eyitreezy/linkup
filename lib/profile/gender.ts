/** Canonical profile gender values stored in `profiles.gender`. */
export type ProfileGender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export const PROFILE_GENDER_OPTIONS: { value: ProfileGender; label: string }[] = [
  { value: 'female', label: 'Woman' },
  { value: 'male', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** Map legacy / display labels → canonical storage value. */
export function normalizeProfileGender(raw: string | null | undefined): ProfileGender | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'woman' || s === 'women' || s === 'female') return 'female';
  if (s === 'man' || s === 'men' || s === 'male') return 'male';
  if (s === 'non-binary' || s === 'nonbinary' || s === 'non_binary') return 'non_binary';
  if (s === 'prefer_not_to_say' || s === 'prefer_not' || s === 'prefer_not_to_say') return 'prefer_not_to_say';
  if (s === 'female' || s === 'male' || s === 'non_binary' || s === 'prefer_not_to_say') {
    return s as ProfileGender;
  }
  return null;
}

export function profileGenderLabel(value: string | null | undefined): string | null {
  const normalized = normalizeProfileGender(value);
  if (!normalized) return value?.trim() || null;
  return PROFILE_GENDER_OPTIONS.find((o) => o.value === normalized)?.label ?? value ?? null;
}

/** MatchMaker pool (Nigeria MVP): heterosexual matching only. */
export function matchmakerPoolGender(value: string | null | undefined): 'male' | 'female' | null {
  const g = normalizeProfileGender(value);
  if (g === 'male' || g === 'female') return g;
  return null;
}
