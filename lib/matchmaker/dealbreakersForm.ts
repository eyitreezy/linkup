import type { DealbreakersDraft } from '@/lib/matchmaker/valuesForm';

export function sanitizeDigitsInput(value: string, maxLen: number): string {
  return value.replace(/\D/g, '').slice(0, maxLen);
}

export function parseBoundedInt(value: string | number, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeDealbreakersForSave(dealbreakers: DealbreakersDraft): DealbreakersDraft {
  return {
    ...dealbreakers,
    locationKm: parseBoundedInt(dealbreakers.locationKm, 5, 200, 25),
    ageMin: parseBoundedInt(dealbreakers.ageMin, 18, 80, 22),
    ageMax: parseBoundedInt(dealbreakers.ageMax, 18, 80, 40),
  };
}
