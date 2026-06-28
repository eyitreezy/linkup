import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Debounced postgres_changes on meet_types for the admin catalog panel.
 */
export function subscribeAdminMeetTypesRealtime(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const channel = supabase
    .channel(`admin-meet-types-${Date.now()}:${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meet_types' }, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(onChange, 180);
    })
    .subscribe();

  return () => {
    if (debounce) clearTimeout(debounce);
    void supabase.removeChannel(channel);
  };
}
