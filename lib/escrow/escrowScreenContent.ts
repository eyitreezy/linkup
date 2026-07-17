/**
 * Payment / escrow screen copy matrix — shared with web (`PAYMENT_FLOW_CONTENT_MATRIX.md`).
 * Pure TypeScript; no platform imports.
 */

export type PlanKind = 'standard' | 'mood' | 'group';
export type EscrowPattern = 'A' | 'B' | 'C';
export type ViewerRole = 'host' | 'guest';
export type PaymentScreen = 'secure_payment' | 'agreement';
export type PlanTier = 'paid' | 'free';

export type EscrowScreenPhase =
  | 'free'
  | 'group_host_before_close'
  | 'group_host_after_close'
  | 'group_guest_pending'
  | 'standard_pending'
  | 'user_funded'
  | 'plan_active';

export type DeriveEscrowPhaseParams = {
  isGroupSplit: boolean;
  isHost: boolean;
  hostEscrowId: string | null;
  myEscrowStatus: string | null;
  planStatus: string | null;
  planTier?: PlanTier;
  userLegFunded?: boolean;
};

export type EscrowScreenContentInput = {
  screen: PaymentScreen;
  planTier: PlanTier;
  planKind: PlanKind;
  pattern: EscrowPattern | null;
  role: ViewerRole;
  phase: EscrowScreenPhase;
  isGroupSplit: boolean;
  splitRatioLabel?: string | null;
  counterpartyName?: string | null;
  userLegFunded?: boolean;
};

export type EscrowScreenContent = {
  patternCardKicker: string | null;
  patternCardTitle: string | null;
  patternCardBody: string | null;
  showPatternCard: boolean;
  showPatternLegCards: boolean;
  patternLegHostLabel: string | null;
  patternLegGuestLabel: string | null;
  showGroupHostCloseGuard: boolean;
  showProjectedHostShare: boolean;
  projectedShareNote: string | null;
  showPaymentButton: boolean;
  fundCtaLabel: string | null;
  fundCtaSubtitle: string | null;
  waitingTitle: string | null;
  waitingCopy: string | null;
  showMoodDeadlineBanner: boolean;
  headerSubtitle: string | null;
  trustNote: string | null;
};

const PATTERN_B_KICKER = 'Pattern B · split escrow';
const PATTERN_B_TITLE = 'Each person pays their share here';
const PATTERN_B_BODY =
  'Payments happen on this screen only, not during negotiation. Both legs must complete before the plan goes active.';
const PATTERN_B_HOST_LEG = 'Host share';
const PATTERN_B_GUEST_LEG = 'Guest share';

function appendSplitRatio(body: string, splitRatioLabel?: string | null): string {
  if (!splitRatioLabel?.trim()) return body;
  return `${body} You are funding your portion under the agreed contribution split (${splitRatioLabel.trim()}).`;
}

function fundedStatuses(status: string | null): boolean {
  return status === 'funded' || status === 'active' || status === 'released';
}

export function deriveEscrowPhase(params: DeriveEscrowPhaseParams): EscrowScreenPhase {
  if (params.planTier === 'free') return 'free';
  if (params.planStatus === 'active' || params.planStatus === 'completed') return 'plan_active';
  if (params.userLegFunded) return 'user_funded';
  if (params.myEscrowStatus && fundedStatuses(params.myEscrowStatus)) return 'user_funded';
  if (params.isGroupSplit) {
    if (params.isHost && !params.hostEscrowId) return 'group_host_before_close';
    if (params.isHost && params.hostEscrowId) return 'group_host_after_close';
    return 'group_guest_pending';
  }
  return 'standard_pending';
}

function waitingForHostCopy(counterpartyName?: string | null): string {
  return counterpartyName
    ? `Waiting for ${counterpartyName} to complete checkout on this screen before the plan goes active.`
    : 'Waiting for the host to complete checkout on this screen before the plan goes active.';
}

function waitingForGuestCopy(counterpartyName?: string | null): string {
  return counterpartyName
    ? `Waiting for ${counterpartyName} to complete checkout on this screen before the plan goes active.`
    : 'Waiting for the guest to complete checkout on this screen before the plan goes active.';
}

function groupGuestTrustNote(): string {
  return 'Your payment is held securely in LinkUp escrow until the meetup is confirmed. The plan activates once all guests and the host have funded their shares.';
}

function groupHostTrustNote(): string {
  return 'Your payment is held securely in LinkUp escrow until the meetup is confirmed. The plan activates once all guests have funded their individual shares and your share is received.';
}

function standardTrustNote(): string {
  return 'Your payment is secure and stays in escrow until you confirm the meetup completed successfully.';
}

function resolveGroupSplit(
  input: EscrowScreenContentInput,
  isMood: boolean
): EscrowScreenContent {
  const { screen, role, phase, counterpartyName, userLegFunded } = input;
  const mood = isMood;

  if (phase === 'group_host_before_close') {
    return {
      patternCardKicker: null,
      patternCardTitle: null,
      patternCardBody: null,
      showPatternCard: false,
      showPatternLegCards: false,
      patternLegHostLabel: null,
      patternLegGuestLabel: null,
      showGroupHostCloseGuard: true,
      showProjectedHostShare: screen === 'agreement',
      projectedShareNote:
        'Your share is calculated once you close the group. Review guest contributions on Manage offers before closing.',
      showPaymentButton: false,
      fundCtaLabel: null,
      fundCtaSubtitle: null,
      waitingTitle: null,
      waitingCopy: null,
      showMoodDeadlineBanner: mood,
      headerSubtitle:
        screen === 'agreement'
          ? 'Close the group when all guest amounts are agreed, then complete your host share on the secure payment screen.'
          : null,
      trustNote: null,
    };
  }

  if (role === 'guest') {
    const guestFunded = phase === 'user_funded' || userLegFunded;
    return {
      patternCardKicker: 'Group plan · split escrow',
      patternCardTitle: guestFunded
        ? 'Your share is secured'
        : 'Fund your negotiated share to confirm your slot',
      patternCardBody: guestFunded
        ? 'Your payment is confirmed. The plan activates after all guests and the host have funded their shares.'
        : 'Your share is the amount you and the host agreed during negotiation. Once you fund it, your slot is secured. The plan activates after all shares are funded.',
      showPatternCard: screen === 'secure_payment',
      showPatternLegCards: false,
      patternLegHostLabel: 'Your agreed share',
      patternLegGuestLabel: null,
      showGroupHostCloseGuard: false,
      showProjectedHostShare: false,
      projectedShareNote: null,
      showPaymentButton: !guestFunded && phase !== 'plan_active',
      fundCtaLabel: guestFunded ? 'View payment details' : 'Pay your share',
      fundCtaSubtitle: 'Fund your agreed amount on this screen',
      waitingTitle: guestFunded ? 'Share secured — waiting for activation' : null,
      waitingCopy: guestFunded
        ? 'Your payment is secured. The plan activates after all guests and the host have funded their shares.'
        : null,
      showMoodDeadlineBanner: mood,
      headerSubtitle:
        screen === 'agreement'
          ? guestFunded
            ? 'Your share is secured. Waiting for the host to close the group and complete their payment.'
            : 'Fund your negotiated share on the secure payment screen after you confirm the agreement.'
          : null,
      trustNote: groupGuestTrustNote(),
    };
  }

  // Group host after close (or paying on host escrow row)
  const hostFunded = phase === 'user_funded' || userLegFunded;
  return {
    patternCardKicker: 'Group plan · split escrow',
    patternCardTitle: hostFunded
      ? 'Your host share is secured'
      : 'Pay your host share to activate the plan',
    patternCardBody: hostFunded
      ? 'Your payment is confirmed. The plan activates once all guest shares are funded.'
      : 'Your share was calculated from the plan total after all guests committed their amounts. The plan activates once all guests and your share are funded.',
    showPatternCard: screen === 'secure_payment',
    showPatternLegCards: false,
    patternLegHostLabel: 'Your host share',
    patternLegGuestLabel: null,
    showGroupHostCloseGuard: false,
    showProjectedHostShare: false,
    projectedShareNote: null,
    showPaymentButton: !hostFunded && phase !== 'plan_active',
    fundCtaLabel: hostFunded ? 'View payment details' : 'Pay your share',
    fundCtaSubtitle: 'Fund your host share on this screen',
    waitingTitle: hostFunded ? 'Waiting for guest payments' : null,
    waitingCopy: hostFunded
      ? 'Guests fund their negotiated shares individually. The plan activates once everyone has paid and your share is received.'
      : null,
    showMoodDeadlineBanner: mood,
    headerSubtitle:
      screen === 'agreement'
        ? hostFunded
          ? 'Your share is secured. Waiting for all guests to fund their shares.'
          : 'Complete your host share on the secure payment screen to activate the plan.'
        : null,
    trustNote: groupHostTrustNote(),
  };
}

function resolvePatternB(input: EscrowScreenContentInput, isMood: boolean): EscrowScreenContent {
  const { role, phase, splitRatioLabel, counterpartyName, userLegFunded, screen } = input;
  const userPaid = phase === 'user_funded' || userLegFunded;
  const canPay = role === 'host' || role === 'guest';

  return {
    patternCardKicker: PATTERN_B_KICKER,
    patternCardTitle: PATTERN_B_TITLE,
    patternCardBody: appendSplitRatio(PATTERN_B_BODY, splitRatioLabel),
    showPatternCard: screen === 'secure_payment',
    showPatternLegCards: true,
    patternLegHostLabel: PATTERN_B_HOST_LEG,
    patternLegGuestLabel: PATTERN_B_GUEST_LEG,
    showGroupHostCloseGuard: false,
    showProjectedHostShare: false,
    projectedShareNote: null,
    showPaymentButton: canPay && !userPaid && phase !== 'plan_active',
    fundCtaLabel: 'Pay your share',
    fundCtaSubtitle: 'Guest and host pay separately on this screen',
    waitingTitle: userPaid ? 'Waiting for the other person' : null,
    waitingCopy: userPaid
      ? "Their share is still pending. You'll both get confirmation when escrow is fully funded."
      : null,
    showMoodDeadlineBanner: isMood,
    headerSubtitle:
      screen === 'agreement'
        ? 'Review the summary below. Secure payment happens on the next screen, not while you negotiate.'
        : null,
    trustNote: standardTrustNote(),
  };
}

function resolvePatternA(input: EscrowScreenContentInput, isMood: boolean): EscrowScreenContent {
  const { role, phase, counterpartyName, userLegFunded, screen, planKind } = input;
  const isGroup = planKind === 'group';
  const kicker = isGroup ? 'Group plan · Host funds' : 'Pattern A escrow';
  const hostPays = role === 'host';
  const userPaid = phase === 'user_funded' || userLegFunded;

  return {
    patternCardKicker: kicker,
    patternCardTitle: 'Host funds the full amount',
    patternCardBody: isMood
      ? 'Mood plans require funding within 1 hour. Complete checkout on this screen.'
      : 'Complete checkout on this screen. Funds stay in escrow until the meetup is confirmed.',
    showPatternCard: screen === 'secure_payment',
    showPatternLegCards: false,
    patternLegHostLabel: null,
    patternLegGuestLabel: null,
    showGroupHostCloseGuard: false,
    showProjectedHostShare: false,
    projectedShareNote: null,
    showPaymentButton: hostPays && !userPaid && phase !== 'plan_active',
    fundCtaLabel: 'Fund escrow',
    fundCtaSubtitle: 'Held until meetup is confirmed',
    waitingTitle: !hostPays ? 'Waiting for host payment' : null,
    waitingCopy: !hostPays ? waitingForHostCopy(counterpartyName) : null,
    showMoodDeadlineBanner: isMood,
    headerSubtitle:
      screen === 'agreement'
        ? hostPays
          ? 'Proceed to secure payment after both parties confirm the agreement.'
          : `Waiting for ${counterpartyName ?? 'the host'} to fund escrow.`
        : null,
    trustNote: standardTrustNote(),
  };
}

function resolvePatternC(input: EscrowScreenContentInput, isMood: boolean): EscrowScreenContent {
  const { role, phase, counterpartyName, userLegFunded, screen, planKind } = input;
  const isGroup = planKind === 'group';
  const kicker = isGroup ? 'Group plan · Guest funds' : 'Pattern C escrow';
  const guestPays = role === 'guest';
  const userPaid = phase === 'user_funded' || userLegFunded;

  return {
    patternCardKicker: kicker,
    patternCardTitle: 'Guest funds the full amount',
    patternCardBody: isMood
      ? 'Mood plans require funding within 1 hour. Complete checkout on this screen.'
      : 'Complete checkout on this screen. Funds stay in escrow until the meetup is confirmed.',
    showPatternCard: screen === 'secure_payment',
    showPatternLegCards: false,
    patternLegHostLabel: null,
    patternLegGuestLabel: null,
    showGroupHostCloseGuard: false,
    showProjectedHostShare: false,
    projectedShareNote: null,
    showPaymentButton: guestPays && !userPaid && phase !== 'plan_active',
    fundCtaLabel: 'Pay via Flutterwave',
    fundCtaSubtitle: 'Held until meetup is confirmed',
    waitingTitle: !guestPays ? 'Waiting for guest payment' : null,
    waitingCopy: !guestPays ? waitingForGuestCopy(counterpartyName) : null,
    showMoodDeadlineBanner: isMood,
    headerSubtitle:
      screen === 'agreement'
        ? guestPays
          ? 'Proceed to secure payment after both parties confirm the agreement.'
          : `Waiting for ${counterpartyName ?? 'the guest'} to fund escrow.`
        : null,
    trustNote: standardTrustNote(),
  };
}

function resolveFree(input: EscrowScreenContentInput): EscrowScreenContent {
  return {
    patternCardKicker: null,
    patternCardTitle: null,
    patternCardBody: null,
    showPatternCard: false,
    showPatternLegCards: false,
    patternLegHostLabel: null,
    patternLegGuestLabel: null,
    showGroupHostCloseGuard: false,
    showProjectedHostShare: false,
    projectedShareNote: null,
    showPaymentButton: false,
    fundCtaLabel: null,
    fundCtaSubtitle: null,
    waitingTitle: null,
    waitingCopy: null,
    showMoodDeadlineBanner: false,
    headerSubtitle: 'Review the meetup summary and confirm when you are ready.',
    trustNote: null,
  };
}

function fallbackContent(input: EscrowScreenContentInput): EscrowScreenContent {
  return {
    patternCardKicker: null,
    patternCardTitle: null,
    patternCardBody: null,
    showPatternCard: false,
    showPatternLegCards: false,
    patternLegHostLabel: null,
    patternLegGuestLabel: null,
    showGroupHostCloseGuard: false,
    showProjectedHostShare: false,
    projectedShareNote: null,
    showPaymentButton: true,
    fundCtaLabel: 'Pay your share',
    fundCtaSubtitle: null,
    waitingTitle: null,
    waitingCopy: null,
    showMoodDeadlineBanner: input.planKind === 'mood',
    headerSubtitle: null,
    trustNote: standardTrustNote(),
  };
}

export function resolveEscrowScreenContent(input: EscrowScreenContentInput): EscrowScreenContent {
  if (input.planTier === 'free' || input.phase === 'free') {
    return resolveFree(input);
  }

  if (input.phase === 'plan_active') {
    return {
      ...fallbackContent(input),
      showPaymentButton: false,
      patternCardTitle: null,
      waitingCopy: null,
    };
  }

  const isMood = input.planKind === 'mood';

  if (input.isGroupSplit && input.pattern === 'B') {
    return resolveGroupSplit(input, isMood);
  }

  if (input.planKind === 'group') {
    if (input.pattern === 'A') return resolvePatternA({ ...input, planKind: 'group' }, isMood);
    if (input.pattern === 'C') return resolvePatternC({ ...input, planKind: 'group' }, isMood);
  }

  switch (input.pattern) {
    case 'B':
      return resolvePatternB(input, isMood);
    case 'A':
      return resolvePatternA(input, isMood);
    case 'C':
      return resolvePatternC(input, isMood);
    default:
      return fallbackContent(input);
  }
}
