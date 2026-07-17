import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { getReleaseRecipientLabel, getPaymentStatusLabel } from '@/lib/escrow/releaseCopy';
import {
  isEscrowFullyFundedForMeet,
  isUserEscrowLegFunded,
} from '@/lib/escrow/splitEscrowFunding';
import { patternBLegGrossCents } from '@/lib/plans/planFinancialConfig';
import type { GroupHostShareResolution } from '@/lib/plans/groupSplitDynamic';
import type { DbEscrowTransaction, EscrowStatus } from '@/types/database';

type EscrowPayFields = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'escrow_pattern'
  | 'host_id'
  | 'guest_id'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'amount_cents'
  | 'status'
  | 'host_funded_at'
  | 'guest_funded_at'
>;

/** True when this row is the guest's split leg (host is not paying on this row). */
export function isGuestOnlyEscrowLeg(escrow: EscrowPayFields): boolean {
  return (
    escrow.escrow_pattern === 'B' &&
    escrow.guest_id != null &&
    (escrow.host_share_cents ?? 0) <= 0 &&
    (escrow.guest_share_cents ?? escrow.amount_cents ?? 0) > 0
  );
}

export type ResolveEscrowRowLegAmountOptions = {
  viewerId?: string;
  groupHostShare?: GroupHostShareResolution | null;
  hostEscrowId?: string | null;
  isHostCloseRow?: boolean;
};

/**
 * Gross amount for the paying party on this escrow row (summary "Amount" row).
 */
export function resolveEscrowRowLegAmountCents(
  escrow: EscrowPayFields,
  options?: ResolveEscrowRowLegAmountOptions
): number {
  if (isGuestOnlyEscrowLeg(escrow)) {
    return patternBLegGrossCents(escrow, 'guest');
  }

  const isHostCloseRow =
    options?.isHostCloseRow ??
    ((options?.hostEscrowId != null && escrow.id === options.hostEscrowId) ||
      (escrow.guest_id == null &&
        Math.max(0, escrow.host_share_cents ?? escrow.amount_cents ?? 0) > 0));

  if (isHostCloseRow) {
    const gross = patternBLegGrossCents(escrow, 'host');
    if (gross > 0) return gross;
    return Math.max(
      0,
      options?.groupHostShare?.paymentCents ?? options?.groupHostShare?.displayCents ?? 0
    );
  }

  if (options?.viewerId) {
    return resolveCurrentUserPayCents(escrow, options.viewerId, {
      groupHostShare: options.groupHostShare,
      hostEscrowId: options.hostEscrowId,
      isHostCloseRow: options.isHostCloseRow,
    });
  }

  return Math.max(0, escrow.amount_cents ?? 0);
}

/** Gross amount the current user pays or paid on this escrow row. */
export function resolveCurrentUserPayCents(
  escrow: EscrowPayFields,
  userId: string,
  options?: {
    groupHostShare?: GroupHostShareResolution | null;
    hostEscrowId?: string | null;
    isHostCloseRow?: boolean;
  }
): number {
  const isHost = userId === escrow.host_id;
  const isGuest = userId === escrow.guest_id;
  const guestOnlyLeg = isGuestOnlyEscrowLeg(escrow);

  if (escrow.escrow_pattern === 'B') {
    if (isGuest) {
      return patternBLegGrossCents(escrow, 'guest');
    }
    if (isHost) {
      if (guestOnlyLeg) return 0;

      const isHostCloseRow =
        options?.isHostCloseRow ??
        ((options?.hostEscrowId != null && escrow.id === options.hostEscrowId) ||
          (escrow.guest_id == null &&
            (escrow.host_share_cents ?? escrow.amount_cents ?? 0) > 0));

      if (isHostCloseRow) {
        const gross = patternBLegGrossCents(escrow, 'host');
        if (gross > 0) return gross;
        return Math.max(0, options?.groupHostShare?.paymentCents ?? 0);
      }

      const storedLeg = Math.max(0, escrow.host_share_cents ?? 0);
      if (storedLeg > 0 && (escrow.guest_share_cents ?? 0) > 0) {
        return patternBLegGrossCents(escrow, 'host');
      }
      if (Math.max(0, escrow.amount_cents ?? 0) > 0 && escrow.guest_id == null) {
        return escrow.amount_cents;
      }
      return Math.max(0, options?.groupHostShare?.paymentCents ?? 0);
    }
    return 0;
  }

  const fundingUi = getEscrowFundingUiState(escrow, userId);
  if (fundingUi.canFund) return fundingUi.payAmountCents;
  if (isUserEscrowLegFunded(escrow, userId)) {
    return fundingUi.payAmountCents > 0 ? fundingUi.payAmountCents : escrow.amount_cents;
  }
  return 0;
}

export type UserPaymentStatusOptions = {
  confirmingPayment?: boolean;
  hostName?: string;
  guestName?: string;
};

/** Summary-row payment status for the viewing user. */
export function getUserPaymentStatusLabel(
  escrow: EscrowPayFields,
  userId: string,
  options: UserPaymentStatusOptions = {}
): string {
  const hostName = options.hostName ?? 'Host';
  const guestName = options.guestName ?? 'Guest';
  const pattern = escrow.escrow_pattern;
  const isHost = userId === escrow.host_id;
  const isGuest = userId === escrow.guest_id;
  const myFunded = isUserEscrowLegFunded(escrow, userId);
  const canFund = getEscrowFundingUiState(escrow, userId).canFund;

  if (options.confirmingPayment) {
    return 'Confirming payment';
  }

  if (escrow.status === 'disputed') return 'On hold for dispute';
  if (escrow.status === 'refunded') return 'Refunded';
  if (escrow.status === 'cancelled') return 'Cancelled';
  if (escrow.status === 'released') {
    return getReleaseRecipientLabel(pattern, hostName, guestName);
  }

  if (pattern === 'B' && (isHost || isGuest)) {
    if (isHost && !isGuest && isGuestOnlyEscrowLeg(escrow)) {
      const guestFunded = escrow.guest_id
        ? isUserEscrowLegFunded(escrow, escrow.guest_id)
        : false;
      return guestFunded ? `${guestName} funded` : `Waiting for ${guestName}`;
    }
    if (myFunded) {
      return isEscrowFullyFundedForMeet(escrow)
        ? 'Held securely in escrow'
        : 'Your share funded';
    }
    if (canFund) return 'Waiting for payment';
    return 'Waiting for payment';
  }

  if (canFund) return 'Waiting for payment';

  if (myFunded || escrow.status === 'funded' || escrow.status === 'active') {
    if (pattern === 'A' && isGuest) {
      return `Waiting for ${hostName}`;
    }
    if (pattern === 'C' && isHost) {
      return `Waiting for ${guestName}`;
    }
    return 'Held securely in escrow';
  }

  if (pattern === 'A' && isGuest) {
    return `Waiting for ${hostName}`;
  }
  if (pattern === 'C' && isHost) {
    return `Waiting for ${guestName}`;
  }

  return getPaymentStatusLabel(escrow.status, pattern, hostName, guestName);
}

export type UserEscrowBadgeDisplay = {
  status: EscrowStatus;
  label: string;
};

/** Status pill on escrow screen — reflects the viewing user's leg, not only row status. */
export function getUserEscrowBadgeDisplay(
  escrow: EscrowPayFields,
  userId: string,
  options: UserPaymentStatusOptions = {}
): UserEscrowBadgeDisplay {
  const summaryLabel = getUserPaymentStatusLabel(escrow, userId, options);

  if (escrow.status === 'disputed') {
    return { status: 'disputed', label: 'Disputed' };
  }
  if (escrow.status === 'refunded') {
    return { status: 'refunded', label: 'Refunded' };
  }
  if (escrow.status === 'cancelled') {
    return { status: 'cancelled', label: 'Cancelled' };
  }
  if (escrow.status === 'released') {
    return { status: 'released', label: 'Released' };
  }
  if (options.confirmingPayment) {
    return { status: 'pending_funding', label: 'Confirming' };
  }

  const myFunded = isUserEscrowLegFunded(escrow, userId);
  const canFund = getEscrowFundingUiState(escrow, userId).canFund;
  const isHost = userId === escrow.host_id;
  const isGuest = userId === escrow.guest_id;

  if (isHost && !isGuest && isGuestOnlyEscrowLeg(escrow)) {
    const guestFunded = escrow.guest_id
      ? isUserEscrowLegFunded(escrow, escrow.guest_id)
      : false;
    return {
      status: guestFunded ? 'funded' : 'pending_funding',
      label: guestFunded ? 'Guest funded' : 'Awaiting guest',
    };
  }

  if (myFunded) {
    return {
      status: 'funded',
      label:
        summaryLabel === 'Your share funded'
          ? 'Funded'
          : summaryLabel === 'Held securely in escrow'
            ? 'Held in escrow'
            : 'Funded',
    };
  }

  if (canFund) {
    return { status: 'pending_funding', label: 'Pending funding' };
  }

  if (escrow.status === 'funded' || escrow.status === 'active') {
    return { status: escrow.status, label: 'Held in escrow' };
  }

  if (summaryLabel.startsWith('Waiting for')) {
    return { status: 'pending_funding', label: 'Awaiting payment' };
  }

  return {
    status: escrow.status,
    label:
      escrow.status === 'pending_funding'
        ? 'Pending funding'
        : escrow.status === 'funded' || escrow.status === 'active'
          ? 'Funded'
          : summaryLabel,
  };
}
