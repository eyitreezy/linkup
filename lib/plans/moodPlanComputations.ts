/** Mood window + listing TTL helpers — keep client/server expectations aligned with mood_expires_at trigger. */

export type MoodWindowPreset = 'now' | 'within_1h' | 'tonight' | 'weekend' | 'custom';
export type MoodListingHours = 1 | 3 | 6 | 12 | 24;
export type UrgencyLevel = 'happening_now' | 'ending_soon' | 'tonight_only' | 'last_spot';

export function computeMoodWindowBounds(
  preset: MoodWindowPreset,
  customStart: Date | null,
  customEnd: Date | null,
  scheduledAt: Date
): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'now':
      return { start: now, end: scheduledAt };
    case 'within_1h': {
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      return { start: now, end: end.getTime() > scheduledAt.getTime() ? scheduledAt : end };
    }
    case 'tonight': {
      const eod = new Date(now);
      eod.setHours(23, 59, 59, 999);
      return {
        start: now,
        end: eod.getTime() > scheduledAt.getTime() ? scheduledAt : eod,
      };
    }
    case 'weekend': {
      const d = new Date(now);
      const day = d.getDay();
      const add = day === 5 || day === 6 ? (day === 5 ? 1 : 0) : (5 - day + 7) % 7;
      const sat = new Date(d);
      sat.setDate(d.getDate() + add);
      sat.setHours(23, 59, 59, 999);
      return {
        start: now,
        end: sat.getTime() > scheduledAt.getTime() ? scheduledAt : sat,
      };
    }
    case 'custom':
    default:
      return {
        start: customStart ?? now,
        end: customEnd ?? scheduledAt,
      };
  }
}

/** When the plan drops off mood-first discover ordering (must be non-null for is_mood_plan trigger). */
export function computeMoodExpiresAt(args: {
  scheduledAt: Date;
  listingHours: MoodListingHours;
  window: MoodWindowPreset;
  customStart: Date | null;
  customEnd: Date | null;
}): Date {
  const now = Date.now();
  const listingEnd = now + args.listingHours * 3600 * 1000;
  const meet = args.scheduledAt.getTime();
  const beforeMeet = meet - 10 * 60 * 1000;
  return new Date(Math.min(listingEnd, beforeMeet, meet));
}

export function computeUrgencyLevel(moodExpiresAt: Date, scheduledAt: Date): UrgencyLevel {
  const now = Date.now();
  const ttl = moodExpiresAt.getTime() - now;
  if (ttl < 10 * 60 * 1000) return 'last_spot';
  if (ttl < 45 * 60 * 1000) return 'ending_soon';
  const t0 = new Date(now);
  if (
    scheduledAt.getDate() === t0.getDate() &&
    scheduledAt.getMonth() === t0.getMonth() &&
    scheduledAt.getFullYear() === t0.getFullYear()
  ) {
    return 'tonight_only';
  }
  return 'happening_now';
}

export function moodNegotiationExpiresAt(isMood: boolean, hours: number): Date | null {
  if (!isMood) return null;
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

/** Gold/Platinum Friday — Weekend Plan label in create wizard. */
export function isFridayActivation(): boolean {
  return new Date().getDay() === 5;
}
