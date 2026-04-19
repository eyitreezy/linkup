import { scoreProfileBio } from '@/lib/ai';

/**
 * Placeholder pipeline: replace with vendor webhooks / Edge Functions
 * (face match, liveness, fraud signals).
 */
export async function runKycAiPlaceholder(args: {
  idStoragePath: string;
  videoStoragePath: string;
}): Promise<{ trust_score: number; flags: string[]; note: string }> {
  const hint = `kyc:${args.idStoragePath}:${args.videoStoragePath}`;
  const ai = await scoreProfileBio(hint);
  return {
    trust_score: ai.trust_score,
    flags: ai.flags,
    note: 'placeholder_face_match_liveness_fraud',
  };
}
