import { supabase } from '@/lib/supabase';
import type { PrivacyConsentMethod } from '@/types/database';

export async function fetchCurrentPrivacyPolicyVersionId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('privacy_policy_versions')
    .select('id')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn('[privacy] fetch current version:', error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Record consent for the latest published policy version. No-op if none published. */
export async function recordPrivacyConsent(
  userId: string,
  consentMethod: PrivacyConsentMethod
): Promise<{ ok: boolean }> {
  const versionId = await fetchCurrentPrivacyPolicyVersionId();
  if (!versionId) {
    if (__DEV__) console.warn('[privacy] no published policy — skipping consent insert');
    return { ok: true };
  }

  const { error } = await supabase.from('privacy_policy_consents').insert({
    user_id: userId,
    policy_version_id: versionId,
    consent_method: consentMethod,
  });

  if (error?.code === '23505') return { ok: true };
  if (error) {
    if (__DEV__) console.warn('[privacy] consent insert failed:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
