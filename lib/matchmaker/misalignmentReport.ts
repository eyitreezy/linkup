export const MISALIGNMENT_REPORT_MAX_EXPLANATION = 200;

export const MISALIGNMENT_REPORT_REASONS = [
  { code: 'explicit_content', label: 'Explicit or inappropriate content' },
  { code: 'pressure_coercion', label: 'Pressure or coercion' },
  { code: 'financial_scam', label: 'Financial solicitation or scam behaviour' },
  { code: 'not_sincere', label: 'Not using MatchMaker sincerely' },
  { code: 'other', label: 'Other' },
] as const;

export type MisalignmentReportReasonCode = (typeof MISALIGNMENT_REPORT_REASONS)[number]['code'];

export function sanitizeMisalignmentExplanation(value: string): string {
  return value.slice(0, MISALIGNMENT_REPORT_MAX_EXPLANATION);
}

export function validateMisalignmentSubmission(
  reason: MisalignmentReportReasonCode | null,
  explanation: string
): { ok: true } | { ok: false; error: string } {
  if (!reason) {
    return { ok: false, error: 'Select a reason before submitting.' };
  }
  const trimmed = explanation.trim();
  if (trimmed.length > MISALIGNMENT_REPORT_MAX_EXPLANATION) {
    return {
      ok: false,
      error: `Explanation must be ${MISALIGNMENT_REPORT_MAX_EXPLANATION} characters or fewer.`,
    };
  }
  return { ok: true };
}
