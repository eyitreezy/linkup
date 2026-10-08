export const END_CONNECTION_REASON_OPTIONS = [
  'Not compatible',
  'Moving too slowly',
  'Not feeling it',
  'Personal reasons',
  'Other',
] as const;

export type EndConnectionReasonOption = (typeof END_CONNECTION_REASON_OPTIONS)[number];

export const END_CONNECTION_OTHER_LABEL: EndConnectionReasonOption = 'Other';

export const END_CONNECTION_OTHER_MAX_LENGTH = 40;

export function clampOtherReasonInput(raw: string): string {
  return raw.slice(0, END_CONNECTION_OTHER_MAX_LENGTH);
}

export function buildEndConnectionReasonForRpc(
  selected: EndConnectionReasonOption | null,
  otherText: string
): { ok: true; reason: string } | { ok: false; message: string } {
  if (!selected) {
    return { ok: false, message: 'Select a reason to continue.' };
  }
  if (selected !== END_CONNECTION_OTHER_LABEL) {
    return { ok: true, reason: selected };
  }
  const trimmed = otherText.trim();
  if (!trimmed) {
    return { ok: false, message: 'Please enter your reason.' };
  }
  if (trimmed.length > END_CONNECTION_OTHER_MAX_LENGTH) {
    return { ok: false, message: 'Reason must be 40 characters or fewer.' };
  }
  return { ok: true, reason: `Other: ${clampOtherReasonInput(trimmed)}` };
}
