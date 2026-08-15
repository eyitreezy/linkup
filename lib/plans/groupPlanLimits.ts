/** Minimum allowed max_guests for group plans (host + guests capacity). */
export const GROUP_PLAN_MIN_MAX_GUESTS = 5;

/** Upper bound for the Maximum guests stepper/input. */
export const GROUP_PLAN_MAX_MAX_GUESTS = 20;

export function clampGroupPlanMaxGuests(value: number): number {
  if (!Number.isFinite(value)) return GROUP_PLAN_MIN_MAX_GUESTS;
  return Math.min(
    GROUP_PLAN_MAX_MAX_GUESTS,
    Math.max(GROUP_PLAN_MIN_MAX_GUESTS, Math.floor(value))
  );
}

export function parseGroupPlanMaxGuestsInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}
