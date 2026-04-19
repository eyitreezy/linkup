import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendExpoPushIfAllowed } from './expoPush.ts';

export type NotificationPriority = 'high' | 'medium' | 'low';

export type DispatchArgs = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  dedupeKey?: string | null;
  /** Default true — set false when a Database Webhook will send push to avoid duplicates. */
  sendPush?: boolean;
};

/**
 * Insert in-app notification (SECURITY DEFINER RPC) then optional Expo push.
 */
export async function dispatchUserNotification(supabase: SupabaseClient, args: DispatchArgs): Promise<void> {
  const { error } = await supabase.rpc('create_notification', {
    p_user_id: args.userId,
    p_type: args.type,
    p_title: args.title,
    p_body: args.body,
    p_data: args.data,
    p_priority: args.priority,
    p_dedupe_key: args.dedupeKey ?? null,
  });

  if (error) {
    console.error('[dispatch] create_notification', args.userId, args.type, error.message);
    throw error;
  }

  if (args.sendPush !== false) {
    await sendExpoPushIfAllowed(supabase, args.userId, args.title, args.body, {
      ...args.data,
      type: args.type,
    });
  }
}
