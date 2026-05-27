/** Premium discover feed — price bounds stored as cents; inputs use major currency units. */

export function formatFilterPriceMajor(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '';
  return String(Math.round(cents / 100));
}

/** Parse digits from input as major units → cents. Empty / zero → null (no bound). */
export function parseFilterPriceMajor(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const major = Number.parseInt(digits, 10);
  if (!Number.isFinite(major) || major <= 0) return null;
  return major * 100;
}
