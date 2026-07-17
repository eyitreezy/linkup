import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import type { DbEscrowTransaction, EscrowPattern } from '@/types/database';

export type EscrowFundingUiState = {
  canFund: boolean;
  payAmountCents: number;
  escrowLeg: 'host' | 'guest' | undefined;
  showSplitCard: boolean;
  showSinglePayerCard: boolean;
  waitingForCounterparty: boolean;
  waitingTitle: string | null;
  waitingSubtitle: string | null;
  fundCtaTitle: string;
  userRole: 'host' | 'guest' | 'other';
};

type EscrowFundingFields = Pick<
  DbEscrowTransaction,
  | 'status'
  | 'escrow_pattern'
  | 'payer_id'
  | 'host_id'
  | 'guest_id'
  | 'amount_cents'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'host_funded_at'
  | 'guest_funded_at'
>;

/** Who can pay on `/escrow/[id]` — mirrors group split leg logic for all patterns. */
export function getEscrowFundingUiState(escrow: EscrowFundingFields, userId: string): EscrowFundingUiState {
  const pattern = (escrow.escrow_pattern ?? 'A') as EscrowPattern;
  const pending = escrow.status === 'pending_funding';
  const isHost = userId === escrow.host_id;
  const isGuest = userId === escrow.guest_id;
  const userRole: EscrowFundingUiState['userRole'] = isHost ? 'host' : isGuest ? 'guest' : 'other';

  const idle: EscrowFundingUiState = {
    canFund: false,
    payAmountCents: 0,
    escrowLeg: undefined,
    showSplitCard: false,
    showSinglePayerCard: false,
    waitingForCounterparty: false,
    waitingTitle: null,
    waitingSubtitle: null,
    fundCtaTitle: 'Fund escrow',
    userRole,
  };

  if (!pending) return idle;

  if (pattern === 'B') {
    const hostShareBudget = escrow.host_share_cents ?? 0;
    const guestShareBudget = escrow.guest_share_cents ?? 0;
    const hostPay =
      hostShareBudget > 0
        ? grossAmountCents(hostShareBudget)
        : escrow.guest_id == null
          ? escrow.amount_cents
          : 0;
    const guestPay =
      guestShareBudget > 0
        ? grossAmountCents(guestShareBudget)
        : escrow.guest_id != null
          ? escrow.amount_cents
          : 0;
    const hostNeeds = isHost && !escrow.host_funded_at && hostPay > 0;
    const guestNeeds = isGuest && !escrow.guest_funded_at && guestPay > 0;
    const userPaidLeg =
      (isHost && !!escrow.host_funded_at) || (isGuest && !!escrow.guest_funded_at);
    const bothDone = !!escrow.host_funded_at && !!escrow.guest_funded_at;

    if (hostNeeds) {
      return {
        ...idle,
        canFund: true,
        payAmountCents: hostPay,
        escrowLeg: 'host',
        showSplitCard: true,
        fundCtaTitle: 'Pay your share',
      };
    }
    if (guestNeeds) {
      return {
        ...idle,
        canFund: true,
        payAmountCents: guestPay,
        escrowLeg: 'guest',
        showSplitCard: true,
        fundCtaTitle: 'Pay your share',
      };
    }
    if (userPaidLeg && !bothDone) {
      return {
        ...idle,
        showSplitCard: true,
        waitingForCounterparty: true,
        waitingTitle: 'Waiting for the other person',
        waitingSubtitle:
          "Their share is still pending. You'll both get confirmation when escrow is fully funded.",
      };
    }
    return { ...idle, showSplitCard: true };
  }

  if (pattern === 'A' && isHost) {
    return {
      ...idle,
      canFund: true,
      payAmountCents: escrow.amount_cents,
      showSinglePayerCard: true,
      fundCtaTitle: 'Fund escrow',
    };
  }

  if (pattern === 'C' && isGuest) {
    return {
      ...idle,
      canFund: true,
      payAmountCents: escrow.amount_cents,
      showSinglePayerCard: true,
      fundCtaTitle: 'Pay via Flutterwave',
    };
  }

  if (pattern === 'A' && isGuest) {
    return {
      ...idle,
      showSinglePayerCard: true,
      waitingForCounterparty: true,
      waitingTitle: 'Waiting for host payment',
      waitingSubtitle:
        'The host must complete checkout on this screen before the plan goes active.',
    };
  }

  if (pattern === 'C' && isHost) {
    return {
      ...idle,
      showSinglePayerCard: true,
      waitingForCounterparty: true,
      waitingTitle: 'Waiting for guest payment',
      waitingSubtitle:
        'Your guest must complete checkout on this screen before the plan goes active.',
    };
  }

  return idle;
}
