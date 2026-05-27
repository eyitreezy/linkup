import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/** Fire-and-forget server moderation log (Edge) after content is persisted. */
export async function persistModerationAfterSend(args: {
  contentType: 'message' | 'plan' | 'profile';
  contentId: string;
  textSample: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.functions.invoke('moderation-check', {
      body: {
        content_type: args.contentType,
        content_id: args.contentId,
        text_sample: args.textSample ?? '',
      },
    });
    if (error && __DEV__) {
      console.warn('[moderation-check]', error.message);
    }
  } catch (e) {
    if (__DEV__) console.warn('[moderation-check]', e);
  }
}
