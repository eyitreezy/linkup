import { supabase } from '@/lib/supabase';
import type {
  DbDispute,
  DbEscrowTransaction,
  DbModerationLog,
  DbReport,
  DbSupportTicket,
  DbVerificationRequest,
} from '@/types/database';

export type KycProfileSnippet = { display_name: string | null; avatar_url: string | null };

export type VerRow = Pick<
  DbVerificationRequest,
  | 'id'
  | 'user_id'
  | 'status'
  | 'created_at'
  | 'rejection_reason'
  | 'id_document_path'
  | 'selfie_video_path'
  | 'reviewed_by'
>;

export type EscrowDisputeAdminRow = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  escrow_id: string | null;
  opened_by: string | null;
  admin_resolution: string | null;
  support_ticket_id: string | null;
  detail: string | null;
  queue_priority?: number | null;
  sla_deadline?: string | null;
  escrow_row?: Pick<
    DbEscrowTransaction,
    'id' | 'amount_cents' | 'currency' | 'plan_id' | 'payer_id' | 'payee_id' | 'status'
  > | null;
};

const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function loadVerifyTabData(): Promise<{
  ver: VerRow[];
  kycProfiles: Record<string, KycProfileSnippet>;
}> {
  const { data: v } = await supabase
    .from('verification_requests')
    .select(
      'id, user_id, status, created_at, rejection_reason, id_document_path, selfie_video_path, reviewed_by'
    )
    .order('created_at', { ascending: false })
    .limit(40);

  const rows = (v ?? []) as VerRow[];
  const uidSet = [...new Set(rows.map((r) => r.user_id))];
  if (!uidSet.length) return { ver: rows, kycProfiles: {} };

  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', uidSet);

  const kycProfiles: Record<string, KycProfileSnippet> = {};
  for (const p of profs ?? []) {
    kycProfiles[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url };
  }
  return { ver: rows, kycProfiles };
}

export async function loadReportsTabData(): Promise<{ reports: DbReport[] }> {
  const { data: r } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80);
  return { reports: (r ?? []) as DbReport[] };
}

export async function loadPlanDisputesTabData(): Promise<{
  planDisputes: DbDispute[];
  disp: EscrowDisputeAdminRow[];
}> {
  const [{ data: pdi }, { data: d }] = await Promise.all([
    supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(80),
    supabase
      .from('escrow_disputes')
      .select(
        'id, reason, status, created_at, resolved_at, escrow_id, opened_by, admin_resolution, support_ticket_id, detail, queue_priority'
      )
      .order('queue_priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(40),
  ]);

  const planDisputes = (pdi ?? []) as DbDispute[];
  if (!d?.length) return { planDisputes, disp: [] };

  const escrowIds = [
    ...new Set(
      d
        .map((x: { escrow_id: string | null }) => x.escrow_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const ticketIds = [
    ...new Set(
      d
        .map((x: { support_ticket_id: string | null }) => x.support_ticket_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  const [escrowsRes, linkedTicketsRes] = await Promise.all([
    escrowIds.length
      ? supabase
          .from('escrow_transactions')
          .select('id, amount_cents, currency, plan_id, payer_id, payee_id, status')
          .in('id', escrowIds)
      : Promise.resolve({ data: [] as DbEscrowTransaction[] }),
    ticketIds.length
      ? supabase.from('support_tickets').select('id, sla_deadline').in('id', ticketIds)
      : Promise.resolve({ data: [] as { id: string; sla_deadline: string | null }[] }),
  ]);

  const byEscrow: Record<
    string,
    Pick<DbEscrowTransaction, 'id' | 'amount_cents' | 'currency' | 'plan_id' | 'payer_id' | 'payee_id' | 'status'>
  > = {};
  for (const e of escrowsRes.data ?? []) {
    byEscrow[e.id] = e as (typeof byEscrow)[string];
  }
  const slaByTicket: Record<string, string> = {};
  for (const tk of linkedTicketsRes.data ?? []) {
    if (tk.sla_deadline) slaByTicket[tk.id] = tk.sla_deadline as string;
  }

  const disp = d.map((row) => ({
    ...(row as EscrowDisputeAdminRow),
    escrow_row: row.escrow_id ? byEscrow[row.escrow_id] ?? null : null,
    sla_deadline: row.support_ticket_id ? slaByTicket[row.support_ticket_id] ?? null : null,
  }));

  return { planDisputes, disp };
}

export async function loadSupportTabData(): Promise<{ tickets: DbSupportTicket[] }> {
  const { data: t } = await supabase
    .from('support_tickets')
    .select(
      'id, user_id, subject, body, status, priority, queue_priority, sla_deadline, is_concierge, created_at, updated_at'
    )
    .order('queue_priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(120);
  return { tickets: (t ?? []) as DbSupportTicket[] };
}

export async function loadModerationTabData(): Promise<{
  mods: DbModerationLog[];
  modProfiles: Record<string, KycProfileSnippet>;
  modMessagePreview: Record<string, string>;
  modPlanTitle: Record<string, string>;
}> {
  const { data: m } = await supabase
    .from('moderation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(120);

  if (!m?.length) {
    return { mods: [], modProfiles: {}, modMessagePreview: {}, modPlanTitle: {} };
  }

  const rows = m as DbModerationLog[];
  rows.sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));

  const modUserIds = [...new Set(rows.map((r) => r.user_id))];
  const messageIds = [...new Set(rows.filter((r) => r.content_type === 'message').map((r) => r.content_id))];
  const planIds = [...new Set(rows.filter((r) => r.content_type === 'plan').map((r) => r.content_id))];

  const [profsRes, msgsRes, plansRes] = await Promise.all([
    modUserIds.length
      ? supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', modUserIds)
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? supabase.from('messages').select('id, text, body').in('id', messageIds)
      : Promise.resolve({ data: [] }),
    planIds.length
      ? supabase.from('plans').select('id, title').in('id', planIds)
      : Promise.resolve({ data: [] }),
  ]);

  const modProfiles: Record<string, KycProfileSnippet> = {};
  for (const p of profsRes.data ?? []) {
    modProfiles[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url };
  }

  const modMessagePreview: Record<string, string> = {};
  for (const row of msgsRes.data ?? []) {
    const r = row as { id: string; text: string | null; body: string | null };
    const blob = r.text ?? r.body;
    if (typeof blob === 'string' && blob.trim()) modMessagePreview[r.id] = blob.trim().slice(0, 320);
  }

  const modPlanTitle: Record<string, string> = {};
  for (const row of plansRes.data ?? []) {
    const r = row as { id: string; title: string | null };
    const title = r.title?.trim();
    if (title) modPlanTitle[r.id] = title.slice(0, 160);
  }

  return { mods: rows, modProfiles, modMessagePreview, modPlanTitle };
}
