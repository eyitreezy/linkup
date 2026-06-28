import { supabase } from '@/lib/supabase';

export type AdminDashboardCounts = {
  kycPending: number;
  reportsPending: number;
  disputesOpen: number;
  modHigh: number;
  escrowOpen: number;
  ticketsOpen: number;
};

const EMPTY: AdminDashboardCounts = {
  kycPending: 0,
  reportsPending: 0,
  disputesOpen: 0,
  modHigh: 0,
  escrowOpen: 0,
  ticketsOpen: 0,
};

/** Lightweight head/count queries for the admin header — avoids loading full tab datasets up front. */
export async function fetchAdminDashboardCounts(): Promise<AdminDashboardCounts> {
  const [
    kycRes,
    reportsRes,
    planDispRes,
    modRes,
    escrowRes,
    ticketsRes,
  ] = await Promise.all([
    supabase
      .from('verification_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'reviewing']),
    supabase.from('moderation_logs').select('*', { count: 'exact', head: true }).eq('severity', 'high'),
    supabase
      .from('escrow_disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'under_review']),
    supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
  ]);

  return {
    kycPending: kycRes.count ?? 0,
    reportsPending: reportsRes.count ?? 0,
    disputesOpen: planDispRes.count ?? 0,
    modHigh: modRes.count ?? 0,
    escrowOpen: escrowRes.count ?? 0,
    ticketsOpen: ticketsRes.count ?? 0,
  };
}

export { EMPTY as emptyAdminDashboardCounts };
