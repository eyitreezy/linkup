/** In-app types intended for platform admins only — hidden from member inboxes. */
export const ADMIN_ONLY_NOTIFICATION_TYPES = new Set([
  'meet_type_submitted',
  'report_submitted',
  'moderation_flagged',
]);

export function isAdminOnlyNotificationType(type: string): boolean {
  return ADMIN_ONLY_NOTIFICATION_TYPES.has(type);
}
