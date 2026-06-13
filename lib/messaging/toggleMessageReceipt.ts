import { supabase } from '@/lib/supabase';

export async function toggleMessageReceipt(
  messageId: string,
  hidden: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('messages')
    .update({ receipt_hidden: hidden })
    .eq('id', messageId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
