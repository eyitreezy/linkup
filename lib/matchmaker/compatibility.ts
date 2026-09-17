import type { MatchMakerPoolProfile } from '@/lib/matchmaker/types';

const COMM_LABELS: Record<string, string> = {
  daily: 'Both prefer regular daily contact',
  few_times_week: 'Both prefer a few check-ins each week',
  flexible: 'Both prefer a flexible communication pace',
};

export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function buildCompatibilitySignals(
  profile: MatchMakerPoolProfile,
  viewerCommStyle?: string | null
): string[] {
  const signals: string[] = [];
  if (profile.distance_km != null && profile.distance_km <= 15) {
    signals.push(`Close in location${profile.distance_km <= 10 ? ` (${profile.distance_km} km)` : ''}`);
  }
  if (viewerCommStyle && profile.communication_style === viewerCommStyle) {
    signals.push(COMM_LABELS[profile.communication_style] ?? 'Similar communication style');
  }
  if (profile.interests?.length) {
    signals.push(`Shared interests: ${profile.interests.slice(0, 2).join(', ')}`);
  }
  if (signals.length === 0 && profile.location_label) {
    signals.push(`Based in ${profile.location_label}`);
  }
  return signals.slice(0, 3);
}
