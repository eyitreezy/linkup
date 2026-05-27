/**
 * Block off-platform contact details until both parties completed the shared plan
 * (see pair_contact_share_unlocked + plan_completion_acks).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

/** Nigerian numbers: +234, 234, and common 0-prefix mobile ranges. */
const NG_LINE_RE =
  /(\+?234|0)\s*([7-9]\d{2}|\d{2}\s*\d{3}\s*\d{4}|[7-9]\d{8,9}\b)|\b\+234\s*\d{7,12}\b|\b234\s*\d{7,12}\b|\b0[789][01]\d{8}\b/gi;

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** URLs and obvious “add me” patterns for off-platform apps. */
export function detectOffPlatformContact(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (EMAIL_RE.test(t)) return true;

  const compact = t.replace(/[\s\-().]/g, '');
  NG_LINE_RE.lastIndex = 0;
  if (NG_LINE_RE.test(compact) || NG_LINE_RE.test(t)) return true;

  const n = normalizeText(t);

  if (/\bwhatsapp\b|\bwa\.me\b|whats\s*app/i.test(t)) return true;
  if (/\btelegram\b|t\.me\//i.test(t)) return true;
  if (/\binstagram\b|\binsta\b|ig\.me\b/i.test(t)) return true;
  if (/\bsnapchat\b|\bsnap\b/i.test(t)) {
    if (/\bsnap\s*chat\b|\bsnapchat\b|👻|snap:\s*@/i.test(t)) return true;
    if (/\badd\s+me\b.*\bsnap/i.test(n)) return true;
  }

  if (/\+\d{10,15}\b/.test(compact)) return true;

  return false;
}

/** Shown in modal — keep short for notification hygiene elsewhere. */
export const CONTACT_SHARE_BLOCKED_BODY =
  'For your safety, sharing contact details is only allowed after plan completion.';

export async function pairContactShareUnlocked(
  client: SupabaseClient,
  peerUserId: string
): Promise<boolean> {
  const { data, error } = await client.rpc('pair_contact_share_unlocked', { p_peer_id: peerUserId });
  if (error) return false;
  return data === true;
}
