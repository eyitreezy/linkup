export type TravelQuickPreset = {
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string;
};

/** African travel destinations and popular areas for Travel Mode quick presets. */
export const TRAVEL_QUICK_PRESETS: TravelQuickPreset[] = [
  { label: 'Lagos, Nigeria', latitude: 6.5244, longitude: 3.3792, countryCode: 'NG' },
  { label: 'Victoria Island, Lagos', latitude: 6.4281, longitude: 3.4219, countryCode: 'NG' },
  { label: 'Lekki, Lagos', latitude: 6.4698, longitude: 3.5852, countryCode: 'NG' },
  { label: 'Ikeja, Lagos', latitude: 6.6018, longitude: 3.3515, countryCode: 'NG' },
  { label: 'Yaba, Lagos', latitude: 6.5095, longitude: 3.3711, countryCode: 'NG' },
  { label: 'Eko Atlantic, Lagos', latitude: 6.4072, longitude: 3.4025, countryCode: 'NG' },
  { label: 'Abuja, Nigeria', latitude: 9.0765, longitude: 7.3986, countryCode: 'NG' },
  { label: 'Port Harcourt, Nigeria', latitude: 4.8156, longitude: 7.0498, countryCode: 'NG' },
  { label: 'Ibadan, Nigeria', latitude: 7.3775, longitude: 3.947, countryCode: 'NG' },
  { label: 'Kano, Nigeria', latitude: 12.0022, longitude: 8.592, countryCode: 'NG' },
  { label: 'Accra, Ghana', latitude: 5.6037, longitude: -0.187, countryCode: 'GH' },
  { label: 'Kumasi, Ghana', latitude: 6.6885, longitude: -1.6244, countryCode: 'GH' },
  { label: 'Nairobi, Kenya', latitude: -1.2921, longitude: 36.8219, countryCode: 'KE' },
  { label: 'Mombasa, Kenya', latitude: -4.0435, longitude: 39.6682, countryCode: 'KE' },
  { label: 'Cape Town, South Africa', latitude: -33.9249, longitude: 18.4241, countryCode: 'ZA' },
  { label: 'Johannesburg, South Africa', latitude: -26.2041, longitude: 28.0473, countryCode: 'ZA' },
  { label: 'Cairo, Egypt', latitude: 30.0444, longitude: 31.2357, countryCode: 'EG' },
  { label: 'Kigali, Rwanda', latitude: -1.9403, longitude: 29.8739, countryCode: 'RW' },
];

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  nigeria: 'NG',
  ghana: 'GH',
  kenya: 'KE',
  'south africa': 'ZA',
  egypt: 'EG',
  rwanda: 'RW',
};

/** Infer ISO country code from the profile home location label. */
export function resolveProfileCountryCode(
  profile: { location_label?: string | null } | null | undefined
): string | null {
  const label = profile?.location_label?.trim().toLowerCase();
  if (!label) return null;
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (label.includes(name)) return code;
  }
  return null;
}

/** Presets scoped to the user's home country when known; otherwise show all. */
export function travelPresetsForProfile(
  profile: { location_label?: string | null } | null | undefined
): TravelQuickPreset[] {
  const code = resolveProfileCountryCode(profile);
  if (!code) return [...TRAVEL_QUICK_PRESETS];
  const filtered = TRAVEL_QUICK_PRESETS.filter((p) => p.countryCode === code);
  return filtered.length > 0 ? filtered : [...TRAVEL_QUICK_PRESETS];
}
