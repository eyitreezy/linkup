import { supabase } from '@/lib/supabase';
import type { EscrowPattern } from '@/types/database';
import type { PolicyTableRow } from '@/lib/plans/cancellationPolicy';

export type CancellationMatrixPlanType = 'standard' | 'mood' | 'group';

export type CancellationMatrixRow = {
  timing_band: string;
  cancelling_party: string;
  canceller_refund_percent: number;
  other_party_penalty_percent: number;
  other_party_goodwill_credit: string | null;
  trust_strikes: number;
  visibility_reduction_percent: number;
  visibility_reduction_days: number;
  creation_hold_days: number;
  requires_admin_review: boolean;
};

const TIMING_BAND_LABELS: Record<string, string> = {
  '72h_plus': '72+ hours before meetup',
  '48_72h': '48-72 hours before',
  '24_48h': '24-48 hours before',
  within_24h: 'Within 24 hours',
  no_show_emergency: 'No-show (with evidence)',
  no_show_no_contact: 'No-show (no contact)',
};

const NO_SHOW_BANDS = new Set(['no_show_emergency', 'no_show_no_contact']);

function goodwillLabel(value: string | null): string {
  if (value === 'enhanced') return 'Enhanced Goodwill Credits';
  if (value === 'standard') return 'Standard Goodwill Credits';
  return 'None';
}

function trustImpact(row: CancellationMatrixRow): string {
  const parts: string[] = [];
  if (row.trust_strikes > 0) {
    parts.push(`${row.trust_strikes} strike${row.trust_strikes === 1 ? '' : 's'}`);
  }
  if (row.visibility_reduction_percent > 0) {
    parts.push(
      `${row.visibility_reduction_percent}% visibility for ${row.visibility_reduction_days} days`
    );
  }
  if (row.creation_hold_days > 0) {
    parts.push(`${row.creation_hold_days}-day creation hold`);
  }
  if (row.requires_admin_review) {
    parts.push('Admin review');
  }
  return parts.length ? parts.join(' · ') : 'None';
}

export function formatCancellationMatrixValue(row: CancellationMatrixRow): string {
  const refund = `${row.canceller_refund_percent}% refund`;
  const penalty =
    row.other_party_penalty_percent > 0
      ? `${row.other_party_penalty_percent}% to other party`
      : null;
  const goodwill =
    row.other_party_goodwill_credit && row.other_party_goodwill_credit !== 'none'
      ? goodwillLabel(row.other_party_goodwill_credit)
      : null;
  const trust = trustImpact(row);
  return [refund, penalty, goodwill, trust !== 'None' ? trust : null].filter(Boolean).join(' · ');
}

export function matrixRowToPolicyTableRow(row: CancellationMatrixRow): PolicyTableRow {
  const label = TIMING_BAND_LABELS[row.timing_band] ?? row.timing_band;
  const tone: PolicyTableRow['tone'] =
    row.timing_band === '72h_plus'
      ? 'ok'
      : NO_SHOW_BANDS.has(row.timing_band)
        ? 'warn'
        : 'muted';
  return {
    label,
    value: formatCancellationMatrixValue(row),
    tone,
  };
}

export async function fetchCancellationMatrix(
  planType: CancellationMatrixPlanType,
  escrowPattern: EscrowPattern | null | undefined
): Promise<CancellationMatrixRow[]> {
  const pattern = escrowPattern ?? 'A';
  const { data, error } = await supabase
    .from('cancellation_matrix')
    .select(
      'timing_band, cancelling_party, canceller_refund_percent, other_party_penalty_percent, other_party_goodwill_credit, trust_strikes, visibility_reduction_percent, visibility_reduction_days, creation_hold_days, requires_admin_review'
    )
    .eq('plan_type', planType)
    .eq('escrow_pattern', pattern)
    .order('timing_band');

  if (error) throw error;
  return (data ?? []) as CancellationMatrixRow[];
}

export function splitMatrixRows(rows: CancellationMatrixRow[]): {
  timingRows: CancellationMatrixRow[];
  noShowRows: CancellationMatrixRow[];
} {
  const timingRows: CancellationMatrixRow[] = [];
  const noShowRows: CancellationMatrixRow[] = [];
  for (const row of rows) {
    if (NO_SHOW_BANDS.has(row.timing_band)) noShowRows.push(row);
    else timingRows.push(row);
  }
  return { timingRows, noShowRows };
}
