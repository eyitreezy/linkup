export type NotificationWebhookRecord = {
  user_id?: string;
  type?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

/** Normalize Supabase Database Webhook payloads (record vs new, optional wrapper). */
export function parseNotificationWebhookPayload(body: unknown): {
  table: string | undefined;
  eventType: string | undefined;
  record: NotificationWebhookRecord | null;
} {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const payload = (root.payload && typeof root.payload === 'object'
    ? root.payload
    : root) as Record<string, unknown>;

  const table =
    (typeof payload.table === 'string' ? payload.table : undefined) ??
    (typeof root.table === 'string' ? root.table : undefined);

  const eventType =
    (typeof payload.type === 'string' ? payload.type : undefined) ??
    (typeof root.type === 'string' ? root.type : undefined);

  const rawRecord = payload.record ?? payload.new ?? root.record ?? root.new;
  const record =
    rawRecord && typeof rawRecord === 'object' ? (rawRecord as NotificationWebhookRecord) : null;

  return { table, eventType, record };
}
