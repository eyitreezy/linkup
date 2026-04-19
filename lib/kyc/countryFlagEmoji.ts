/**
 * ISO 3166-1 alpha-2 → regional-indicator flag emoji (no image assets).
 * Non-standard codes (e.g. OTHER) return a neutral globe.
 */
const GLOBE = '\u{1F30D}';

export function countryCodeToFlagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === 'OTHER' || c.length !== 2) return GLOBE;
  const a = c.codePointAt(0);
  const b = c.codePointAt(1);
  if (
    a === undefined ||
    b === undefined ||
    a < 65 ||
    a > 90 ||
    b < 65 ||
    b > 90
  ) {
    return GLOBE;
  }
  const REGIONAL_OFFSET = 0x1f1e6;
  return String.fromCodePoint(REGIONAL_OFFSET + (a - 65), REGIONAL_OFFSET + (b - 65));
}
