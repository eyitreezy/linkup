const WEEKEND_VISIBILITY_MIN_HOURS = 48;

/** Show "visible through the weekend" only when listing or meetup duration is at least 48 hours. */
export function shouldShowWeekendVisibilityText(args: {
  listingHours: number;
  durationMinutes: number | null;
}): boolean {
  if (args.listingHours >= WEEKEND_VISIBILITY_MIN_HOURS) return true;
  if (args.durationMinutes != null && args.durationMinutes >= WEEKEND_VISIBILITY_MIN_HOURS * 60) return true;
  return false;
}

export function formatHoursLabel(hours: number): string {
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
}

export function formatDurationMinutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

export const MOOD_LISTING_QUICK_PRESETS = [1, 3, 6, 12, 24] as const;
export const MEETUP_DURATION_QUICK_PRESETS = [30, 60, 90, 120, 180] as const;
