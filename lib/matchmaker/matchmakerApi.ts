import { supabase } from '@/lib/supabase';
import type { MisalignmentReportReasonCode } from '@/lib/matchmaker/misalignmentReport';

export async function respondMatchMakerReaffirmation(
  action: 'yes' | 'snooze' | 'leave'
): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_reaffirmation_respond', { p_action: action });
  if (error) throw error;
}

export async function submitMatchMakerConnectionReport(args: {
  connectionId: string;
  reasonCode: MisalignmentReportReasonCode;
  explanation: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_submit_connection_report', {
    p_connection_id: args.connectionId,
    p_reason_code: args.reasonCode,
    p_explanation: args.explanation,
  });
  if (error) throw error;
}
