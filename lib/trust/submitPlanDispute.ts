import type { SupabaseClient } from '@supabase/supabase-js';
import { readLocalAssetAsUint8Array } from '@/lib/nativeImageRead';
import type { DisputeEvidenceType, PlanDisputeCategory } from '@/types/database';

export type PlanDisputeVideoMeta = {
  uploaded_at_client: string;
  latitude?: number;
  longitude?: number;
  duration_seconds?: number;
};

export async function submitPlanDisputeWithEvidence(
  client: SupabaseClient,
  params: {
    planId: string;
    reporterId: string;
    reportedUserId: string;
    category: PlanDisputeCategory;
    reporterNote: string | null;
    video: { localUri: string; mime: string; ext: string; meta: PlanDisputeVideoMeta };
    optionalImages: { localUri: string; mime: string; ext: string }[];
    textEvidence: string | null;
  }
): Promise<{ disputeId: string | null; error: string | null }> {
  const { data: disputeRow, error: dErr } = await client
    .from('disputes')
    .insert({
      plan_id: params.planId,
      reporter_id: params.reporterId,
      reported_user_id: params.reportedUserId,
      category: params.category,
      status: 'pending',
      reporter_note: params.reporterNote,
    })
    .select('id')
    .single();

  if (dErr || !disputeRow?.id) {
    return { disputeId: null, error: dErr?.message ?? 'Could not create dispute' };
  }

  const disputeId = disputeRow.id as string;

  try {
    const vidBytes = await readLocalAssetAsUint8Array(params.video.localUri);
    const vidPath = `${disputeId}/video-${Date.now()}.${params.video.ext}`;
    const { error: upVErr } = await client.storage.from('private_disputes').upload(vidPath, vidBytes, {
      contentType: params.video.mime,
      upsert: false,
    });
    if (upVErr) throw new Error(upVErr.message);

    const { error: evErr } = await client.from('dispute_evidence').insert({
      dispute_id: disputeId,
      type: 'video' satisfies DisputeEvidenceType,
      file_path: vidPath,
      metadata: params.video.meta as Record<string, unknown>,
    });
    if (evErr) throw new Error(evErr.message);

    for (let i = 0; i < params.optionalImages.length; i++) {
      const img = params.optionalImages[i];
      const bytes = await readLocalAssetAsUint8Array(img.localUri);
      const path = `${disputeId}/image-${Date.now()}-${i}.${img.ext}`;
      const { error: upErr } = await client.storage.from('private_disputes').upload(path, bytes, {
        contentType: img.mime,
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);
      const { error: eErr } = await client.from('dispute_evidence').insert({
        dispute_id: disputeId,
        type: 'image' satisfies DisputeEvidenceType,
        file_path: path,
        metadata: { uploaded_at_client: new Date().toISOString() },
      });
      if (eErr) throw new Error(eErr.message);
    }

    const note = params.textEvidence?.trim();
    if (note) {
      const { error: tErr } = await client.from('dispute_evidence').insert({
        dispute_id: disputeId,
        type: 'text' satisfies DisputeEvidenceType,
        text_body: note,
        metadata: {},
      });
      if (tErr) throw new Error(tErr.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    await client.from('disputes').delete().eq('id', disputeId);
    return { disputeId: null, error: msg };
  }

  return { disputeId, error: null };
}
