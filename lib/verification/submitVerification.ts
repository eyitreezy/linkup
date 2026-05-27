import { prepareVideoForUpload } from '@/lib/verification/compressVideo';
import { readLocalAssetAsUint8Array } from '@/lib/nativeImageRead';
import { supabase } from '@/lib/supabase';
import type { DbVerificationRequest } from '@/types/database';
import type { KycDocumentType } from '@/types/kyc';

const BUCKET = 'verification';

export async function uploadIdImage(userId: string, localUri: string): Promise<{ path: string; error: Error | null }> {
  const path = `${userId}/id-${Date.now()}.jpg`;
  try {
    const bytes = await readLocalAssetAsUint8Array(localUri);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    return { path, error: error ? new Error(error.message) : null };
  } catch (e) {
    return { path, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function uploadLivenessVideo(userId: string, localUri: string): Promise<{ path: string; error: Error | null }> {
  const path = `${userId}/liveness-${Date.now()}.mp4`;
  try {
    const uri = await prepareVideoForUpload(localUri);
    const bytes = await readLocalAssetAsUint8Array(uri);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'video/mp4',
      upsert: true,
    });
    return { path, error: error ? new Error(error.message) : null };
  } catch (e) {
    return { path, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function fetchLatestVerificationRequest(userId: string): Promise<DbVerificationRequest | null> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DbVerificationRequest;
}

export async function submitVerificationBundle(args: {
  userId: string;
  idLocalUri: string;
  videoLocalUri: string;
  countryCode: string | null;
  documentType: KycDocumentType;
  consentAtIso: string;
}): Promise<{ error: Error | null }> {
  const { userId, idLocalUri, videoLocalUri, countryCode, documentType, consentAtIso } = args;

  const upId = await uploadIdImage(userId, idLocalUri);
  if (upId.error) return { error: upId.error };

  const upVid = await uploadLivenessVideo(userId, videoLocalUri);
  if (upVid.error) return { error: upVid.error };

  const { error: insErr } = await supabase.from('verification_requests').insert({
    user_id: userId,
    status: 'pending',
    id_document_path: upId.path,
    selfie_video_path: upVid.path,
    document_type: documentType,
    country_code: countryCode,
    consent_at: consentAtIso,
    ai_analysis: {
      pipeline: 'vendor_pending',
      submitted_at: new Date().toISOString(),
      note: 'Awaiting automated and manual identity checks. You will be notified when the review completes.',
    },
  });

  if (insErr) return { error: new Error(insErr.message) };

  const { error: uErr } = await supabase.from('users').update({ verification_status: 'pending' }).eq('id', userId);

  if (uErr) return { error: new Error(uErr.message) };

  return { error: null };
}
