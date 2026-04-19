/**
 * Placeholder moderation audit trail — replace with Supabase insert / Edge Function in production.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ModerationLogPayload = {
  conversationId: string | undefined;
  senderId: string;
  textSnippet: string;
  status: 'clean' | 'flagged' | 'blocked';
  reason?: string;
};

export function logModerationResult(payload: ModerationLogPayload, _supabase?: SupabaseClient): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[moderation]', payload.status, payload.reason ?? '', payload.textSnippet.slice(0, 80));
  }
}
