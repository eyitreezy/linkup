/**
 * Flutterwave returns `meta` as a flat object, JSON string, or meta_name/meta_value array.
 */
export function normalizeFlutterwaveMeta(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      return normalizeFlutterwaveMeta(JSON.parse(trimmed) as unknown);
    } catch {
      return {};
    }
  }

  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as {
        meta_name?: string;
        meta_value?: unknown;
        name?: string;
        value?: unknown;
      };
      const key = row.meta_name ?? row.name;
      const val = row.meta_value ?? row.value;
      if (typeof key === 'string' && key.length > 0) {
        out[key] = val;
      }
    }
    return out;
  }

  if (typeof raw === 'object') {
    return { ...(raw as Record<string, unknown>) };
  }

  return {};
}

export function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' ? v : undefined;
}

/** tx_ref shape: linkup_esc_{escrow8}_{host|guest|full}_{ts} */
export function parseEscrowLegFromTxRef(txRef: string): 'host' | 'guest' | undefined {
  const m = txRef.match(/_(host|guest|full)_/);
  if (m?.[1] === 'host') return 'host';
  if (m?.[1] === 'guest') return 'guest';
  return undefined;
}

/** Flat 5% platform fee — gross checkout from budget (kobo). */
export function grossAmountCentsFromBudget(budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  return budgetCents + Math.round((budgetCents * 500) / 10_000);
}

type PatternBLegEscrow = {
  amount_cents: number;
  host_share_cents?: number | null;
  guest_share_cents?: number | null;
};

/** Gross checkout for one pattern B leg (single-leg rows use amount_cents). */
export function patternBLegGrossCents(escrow: PatternBLegEscrow, leg: 'host' | 'guest'): number {
  const hostBudget = Math.max(0, escrow.host_share_cents ?? 0);
  const guestBudget = Math.max(0, escrow.guest_share_cents ?? 0);
  if (leg === 'host') {
    if (hostBudget > 0 && guestBudget > 0) return grossAmountCentsFromBudget(hostBudget);
    return Math.max(0, escrow.amount_cents);
  }
  if (guestBudget > 0 && hostBudget > 0) return grossAmountCentsFromBudget(guestBudget);
  return Math.max(0, escrow.amount_cents);
}

/** Infer split leg when meta/tx_ref omit escrow_leg (webhook fallback). */
export function inferEscrowLegFromAmount(
  pattern: string | null | undefined,
  hostShareCents: number | null | undefined,
  guestShareCents: number | null | undefined,
  amountNgn: number | null
): 'host' | 'guest' | undefined {
  if (pattern !== 'B' || amountNgn == null) return undefined;
  const paidKobo = Math.round(amountNgn * 100);
  const hostShare = hostShareCents ?? 0;
  const guestShare = guestShareCents ?? 0;
  const hostGross = hostShare > 0 ? grossAmountCentsFromBudget(hostShare) : 0;
  const guestGross = guestShare > 0 ? grossAmountCentsFromBudget(guestShare) : 0;
  if (hostGross > 0 && Math.abs(paidKobo - hostGross) <= 1) return 'host';
  if (guestGross > 0 && Math.abs(paidKobo - guestGross) <= 1) return 'guest';
  if (hostShare > 0 && Math.abs(paidKobo - hostShare) <= 1) return 'host';
  if (guestShare > 0 && Math.abs(paidKobo - guestShare) <= 1) return 'guest';
  return undefined;
}

/** Escrow checkout tx_ref from create-escrow-payment: linkup_esc_{id8}_{leg}_{ts} */
export function isEscrowFlutterwaveReference(reference: string): boolean {
  return reference.startsWith('linkup_esc_');
}

export function parseFlutterwaveAmountNgn(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
