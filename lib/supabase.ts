/**
 * Supabase client — Auth, Postgres, Storage, Realtime.
 * Uses EXPO_PUBLIC_* vars from app config / .env (see .env.example).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra?.supabaseUrl ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra?.supabaseAnonKey ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** EAS builds omit `.env` unless vars are set in Expo → Environment variables; avoid crashing at import. */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.invalid',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/** Tear down a Realtime channel without surfacing benign unmount races as unhandled rejections. */
export function removeSupabaseChannel(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel).catch(() => {
    // Channel may already be removed during fast navigation or Strict Mode remounts.
  });
}
