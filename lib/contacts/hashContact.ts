/** App-level salt for contact hash matching — never store raw contact data. */
export const CONTACT_HASH_SALT = 'linkup_contact_hash_v1';

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
