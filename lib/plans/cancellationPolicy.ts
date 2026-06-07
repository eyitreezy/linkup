/**
 * Cancellation & refund policy — single source for UI copy and client previews.
 * Server enforcement: `submit_plan_cancellation` (see Supabase migration).
 */
import type { EscrowPattern } from '@/types/database';

export const HOST_CANCEL_HOURS = {
  EARLY: 72,
  MID: 48,
  LATE: 24,
} as const;

export type HostCancelBand = '72_plus' | '48_72' | '24_48' | 'under_24';

/** Guest share of host-funded escrow released on host cancel (basis points). */
export function hostCancelGuestReleaseBps(band: HostCancelBand): number {
  switch (band) {
    case '72_plus':
      return 0;
    case '48_72':
      return 3000;
    case '24_48':
      return 5000;
    case 'under_24':
      return 7000;
    default:
      return 0;
  }
}

export function hostCancelBandFromHours(hoursUntilMeetup: number): HostCancelBand {
  if (hoursUntilMeetup >= HOST_CANCEL_HOURS.EARLY) return '72_plus';
  if (hoursUntilMeetup >= HOST_CANCEL_HOURS.MID) return '48_72';
  if (hoursUntilMeetup >= HOST_CANCEL_HOURS.LATE) return '24_48';
  return 'under_24';
}

export function hostCancelStrikesForBand(band: HostCancelBand): number {
  switch (band) {
    case '72_plus':
      return 0;
    case '48_72':
    case '24_48':
      return 1;
    case 'under_24':
      return 2;
    default:
      return 0;
  }
}

/** Goodwill when host cancels with &lt;48h notice or guest confirms host no-show. */
export function qualifiesForGoodwillCredit(opts: {
  role: 'host' | 'guest';
  hoursUntilMeetup: number;
  isNoShow: boolean;
}): boolean {
  if (opts.isNoShow && opts.role === 'guest') return true;
  if (!opts.isNoShow && opts.role === 'host' && opts.hoursUntilMeetup < HOST_CANCEL_HOURS.MID) {
    return true;
  }
  return false;
}

export function goodwillCreditCents(guestReleaseCents: number): number {
  if (guestReleaseCents <= 0) return 200;
  return Math.min(3000, Math.max(200, Math.floor(guestReleaseCents * 0.08)));
}

export type CancellationFundedLegs = {
  pattern: EscrowPattern;
  hostPaidCents: number;
  guestPaidCents: number;
};

export type CancellationSplit = {
  guestCreditCents: number;
  hostCreditCents: number;
  cancelType: 'early' | 'late' | 'no_show';
  hostBand?: HostCancelBand;
};

/**
 * Preview fund split for funded escrow (matches server rules).
 */
export function computeCancellationSplit(opts: {
  role: 'host' | 'guest';
  hoursUntilMeetup: number;
  isNoShow: boolean;
  legs: CancellationFundedLegs;
}): CancellationSplit {
  const { role, hoursUntilMeetup, isNoShow, legs } = opts;
  const { pattern, hostPaidCents, guestPaidCents } = legs;
  const total = hostPaidCents + guestPaidCents;

  if (isNoShow) {
    if (role === 'host') {
      return { guestCreditCents: 0, hostCreditCents: total, cancelType: 'no_show' };
    }
    return { guestCreditCents: total, hostCreditCents: 0, cancelType: 'no_show' };
  }

  if (role === 'guest') {
    return { guestCreditCents: 0, hostCreditCents: total, cancelType: 'late' };
  }

  const band = hostCancelBandFromHours(hoursUntilMeetup);
  const guestBps = hostCancelGuestReleaseBps(band);
  const cancelType = band === '72_plus' ? 'early' : 'late';

  if (pattern === 'B') {
    const fromHost = Math.floor((hostPaidCents * guestBps) / 10_000);
    return {
      guestCreditCents: guestPaidCents + fromHost,
      hostCreditCents: hostPaidCents - fromHost,
      cancelType,
      hostBand: band,
    };
  }

  const guestCredit = Math.floor((total * guestBps) / 10_000);
  return {
    guestCreditCents: guestCredit,
    hostCreditCents: total - guestCredit,
    cancelType,
    hostBand: band,
  };
}

export type PolicyTableRow = {
  label: string;
  value: string;
  tone: 'ok' | 'muted' | 'warn';
};

export type CancellationPolicyGroup = {
  title: string;
  rows: readonly PolicyTableRow[];
};

/** Agreement screen + shared reference table. */
export const CANCELLATION_POLICY_TABLE_ROWS: PolicyTableRow[] = [
  { label: 'Guest cancel (any time)', value: 'No refund — escrow to host', tone: 'warn' },
  { label: 'Guest no-show', value: 'Host 100% · guest flagged', tone: 'warn' },
  { label: 'Host cancel 72h+', value: '0% guest · 100% host · warning', tone: 'ok' },
  { label: 'Host cancel 48–72h', value: '30% guest · 70% host · 1 strike', tone: 'muted' },
  { label: 'Host cancel 24–48h', value: '50% / 50% · 1 strike', tone: 'muted' },
  { label: 'Host cancel under 24h', value: '70% guest · 30% host · 2 strikes', tone: 'warn' },
  { label: 'Host no-show', value: '100% to guest · host forfeits', tone: 'warn' },
  { label: 'Split plan (Pattern B)', value: 'Matrix on host share; guest share back on host cancel', tone: 'ok' },
  { label: 'Mutual cancel', value: 'Both agree in-app — neutral refund path', tone: 'ok' },
];

const [guestCancel, guestNoShow, host72, host48, host24, hostUnder24, hostNoShow, patternB, mutual] =
  CANCELLATION_POLICY_TABLE_ROWS;

/** Plan creation step 2 — scannable highlights. */
export const COMMITMENT_CANCELLATION_POLICY_ROWS: PolicyTableRow[] = [
  guestCancel,
  {
    label: 'Host cancel',
    value: 'Server-timed bands: 72h+ · 48–72h · 24–48h · under 24h',
    tone: 'muted',
  },
  patternB,
  {
    label: 'Goodwill credits',
    value: 'Host cancel within 48h or no-show · fee offset · 60-day expiry',
    tone: 'ok',
  },
];

/** Pre-agreement modal — grouped policy blocks. */
export const AGREEMENT_CANCELLATION_POLICY_GROUPS: CancellationPolicyGroup[] = [
  { title: 'Guest', rows: [guestCancel, guestNoShow] },
  { title: 'Host cancellation', rows: [host72, host48, host24, hostUnder24] },
  { title: 'No-show & split plans', rows: [hostNoShow, patternB] },
  {
    title: 'Credits & mutual',
    rows: [
      {
        label: 'Goodwill credits',
        value: 'Auto for guest when host cancels <48h or no-shows · not cash',
        tone: 'ok',
      },
      mutual,
    ],
  },
];
