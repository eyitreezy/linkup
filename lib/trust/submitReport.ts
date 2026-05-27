import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type ReportReasonCode = 'scam' | 'fake_profile' | 'harassment' | 'inappropriate' | 'other';

export type SubmitReportArgs = {
  reporterId: string;
  reportedUserId: string;
  contentType: 'message' | 'plan' | 'profile' | 'user';
  contentId: string | null;
  reason: ReportReasonCode;
  note: string | null;
};

export async function submitUserReport(args: SubmitReportArgs): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Not configured' };

  const reasonLabel: Record<ReportReasonCode, string> = {
    scam: 'Scam',
    fake_profile: 'Fake profile',
    harassment: 'Harassment',
    inappropriate: 'Inappropriate content',
    other: 'Other',
  };

  const { error } = await supabase.from('reports').insert({
    reporter_id: args.reporterId,
    reported_user_id: args.reportedUserId,
    content_type: args.contentType,
    content_id: args.contentId,
    reason: reasonLabel[args.reason],
    note: args.note?.trim() || null,
    status: 'pending',
  });

  return { error: error?.message ?? null };
}
