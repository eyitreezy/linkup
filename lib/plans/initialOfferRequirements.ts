import type { DbPlanOffer, DbPlanOfferRound } from '@/types/database';

export type InitialOfferRequirements = {
  requireAmount: boolean;
  requireNote: boolean;
  requireDate: boolean;
};

export type InitialOfferSnapshot = {
  amountCents: number | null;
  note: string | null;
  proposedScheduledAt: string | null;
};

export function getInitialOfferRound(
  rounds: DbPlanOfferRound[]
): DbPlanOfferRound | undefined {
  return rounds.find((r) => r.action === 'offer');
}

export function deriveInitialOfferSnapshot(
  offer: DbPlanOffer,
  rounds: DbPlanOfferRound[]
): InitialOfferSnapshot {
  const initial = getInitialOfferRound(rounds);
  return {
    amountCents: initial?.amount_cents ?? offer.amount_cents ?? null,
    note: initial?.note ?? offer.message ?? null,
    proposedScheduledAt: offer.proposed_scheduled_at ?? null,
  };
}

export function deriveInitialOfferRequirements(
  snapshot: InitialOfferSnapshot
): InitialOfferRequirements {
  return {
    requireAmount: snapshot.amountCents != null,
    requireNote: !!(snapshot.note && snapshot.note.trim()),
    requireDate: !!snapshot.proposedScheduledAt,
  };
}

export function buildRequirementsNotice(req: InitialOfferRequirements): string {
  const parts: string[] = [];
  if (req.requireAmount) parts.push('amount');
  if (req.requireDate) parts.push('date & time');
  if (req.requireNote) parts.push('note');
  if (parts.length === 0) {
    return 'The original offer did not specify amount, time, or note — all fields are optional for your counter.';
  }
  const last = parts[parts.length - 1]!;
  const list =
    parts.length === 1 ? last : `${parts.slice(0, -1).join(', ')} and ${last}`;
  return `The original offer included ${list}. Those fields are required in your counter so both sides stay aligned.`;
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function validateCounterForm(
  req: InitialOfferRequirements,
  values: {
    amountCents: number | null;
    note: string;
    proposedScheduledAt: string | null;
  }
): string | null {
  if (req.requireAmount && values.amountCents == null) {
    return 'Enter an amount — it was part of the original offer.';
  }
  if (req.requireDate && !values.proposedScheduledAt) {
    return 'Pick a date and time — it was part of the original offer.';
  }
  if (req.requireNote && !values.note.trim()) {
    return 'Add a note — it was part of the original offer.';
  }
  return null;
}
