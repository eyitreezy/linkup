/**
 * Moderation audit records are written by the `moderation-check` Edge Function into `moderation_logs`.
 * Chat and other surfaces call `persistModerationAfterSend` after content is saved.
 */

export type ModerationLogPayload = {
  conversationId: string | undefined;
  senderId: string;
  textSnippet: string;
  status: 'clean' | 'flagged' | 'blocked';
  reason?: string;
};

/** @deprecated No-op locally; use `persistModerationAfterSend` from `@/lib/trust/persistModeration`. */
export function logModerationResult(_payload: ModerationLogPayload): void {
  // Server-side logging only — avoids placeholder console noise in production.
}
