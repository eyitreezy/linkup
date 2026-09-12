/**
 * Meetup details — single source of truth for action button visibility.
 */
import { planIsPastNegotiation } from '@/lib/plans/planAgreementRoute';
import {
  isConfirmedGroupGuest,
  resolveGroupGuestMembership,
  resolveGuestParticipationGate,
  type GroupGuestMembershipStatus,
} from '@/lib/plans/groupPlanMembership';
import { isOfferLive } from '@/lib/plans/negotiationState';
import { isUserEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import {
  resolvePlanPayShareState,
  type PlanGuestEscrowSnapshot,
} from '@/lib/plans/planPayShare';
import type { DbPlan, DbPlanOffer, JoinRequestStatus } from '@/types/database';

export type PlanLockState = 'open' | 'partial' | 'full';

export type AcceptedGuestRef = {
  userId: string;
  offerId: string;
};

export type PlanViewerContext = {
  isHost: boolean;
  isMatchedGuest: boolean;
  isNegotiatingGuest: boolean;
  isBrowsingGuest: boolean;
  isStandard: boolean;
  isMood: boolean;
  isGroup: boolean;
  lockState: PlanLockState;
  hasOpenSlots: boolean;
  myOffer: DbPlanOffer | null;
  myOfferIsActive: boolean;
  showSave: boolean;
  showMakeOffer: boolean;
  showViewOffer: boolean;
  showCalendar: boolean;
  showViewAgreement: boolean;
  showGroupGuestAgreements: boolean;
  showMessage: boolean;
  showBoost: boolean;
  showInterest: boolean;
  showManageOffers: boolean;
  showManageRequests: boolean;
  showRequestToJoin: boolean;
  showViewRequest: boolean;
  showConfirmAttendance: boolean;
  showPayShare: boolean;
  payShareEscrowId: string | null;
  payShareAmountLabel: string | null;
  /** Guest membership on group plans — drives request/offer gating. */
  guestMembership: GroupGuestMembershipStatus;
  /** When set, guest cannot request or offer (already guest, group full, etc.). */
  guestParticipationBlockReason: 'already_guest' | 'group_filled' | 'plan_closed' | null;
  acceptedGuests: AcceptedGuestRef[];
  /** @deprecated use isMatchedGuest */
  isMatchParty: boolean;
  userAcceptedOffer: DbPlanOffer | null;
};

export function findMyLatestOffer(
  offers: DbPlanOffer[],
  userId: string | undefined
): DbPlanOffer | null {
  if (!userId) return null;
  const mine = offers.filter((o) => o.bidder_id === userId && o.status !== 'superseded');
  if (mine.length === 0) return null;
  return [...mine].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

export function listAcceptedGuests(offers: DbPlanOffer[]): AcceptedGuestRef[] {
  return offers
    .filter((o) => o.status === 'accepted')
    .map((o) => ({ userId: o.bidder_id, offerId: o.id }));
}

export function acceptedGuestCount(
  plan: Pick<DbPlan, 'accepted_guest_count' | 'is_group_plan'>,
  offers: DbPlanOffer[]
): number {
  const fromOffers = offers.filter((o) => o.status === 'accepted').length;
  if (plan.is_group_plan && plan.accepted_guest_count != null) {
    return Math.max(plan.accepted_guest_count, fromOffers);
  }
  if (fromOffers > 0) return fromOffers;
  return plan.accepted_guest_count ?? 0;
}

export function computePlanLockState(
  plan: DbPlan,
  acceptedCount: number,
  availableSlots?: number | null
): { lockState: PlanLockState; hasOpenSlots: boolean } {
  const isGroup = !!plan.is_group_plan;
  const maxGuests = isGroup ? Math.max(1, plan.max_guests ?? 1) : 1;

  if (isGroup && availableSlots != null) {
    const hasOpenSlots = availableSlots > 0;
    if (!hasOpenSlots) return { lockState: 'full', hasOpenSlots: false };
    if (acceptedCount > 0) return { lockState: 'partial', hasOpenSlots: true };
    return { lockState: 'open', hasOpenSlots: true };
  }

  const hasOpenSlots = isGroup && acceptedCount < maxGuests;

  if (isGroup) {
    if (acceptedCount >= maxGuests) return { lockState: 'full', hasOpenSlots: false };
    if (acceptedCount > 0) return { lockState: 'partial', hasOpenSlots: true };
    return { lockState: 'open', hasOpenSlots: true };
  }

  const oneToOneLocked =
    acceptedCount > 0 || !!plan.accepted_offer_id || planIsPastNegotiation(plan.status);
  return {
    lockState: oneToOneLocked ? 'full' : 'open',
    hasOpenSlots: false,
  };
}

export function derivePlanViewerContext(
  plan: DbPlan,
  userId: string | undefined,
  offers: DbPlanOffer[],
  opts?: {
    /** When true, guest/host participation actions (offer, join, invite) are blocked. */
    planExpired?: boolean;
    /** @deprecated pass planExpired */
    moodClosed?: boolean;
    completionSelfAcked?: boolean;
    myJoinRequest?: { id: string; status: JoinRequestStatus } | null;
    myGuestEscrow?: PlanGuestEscrowSnapshot | null;
    hasOptedOut?: boolean;
    invitationAccepted?: boolean;
    /** RPC-backed open guest slots (group plans). */
    availableSlots?: number | null;
  }
): PlanViewerContext {
  const planExpired = opts?.planExpired ?? opts?.moodClosed ?? false;
  const completionSelfAcked = opts?.completionSelfAcked ?? false;
  const myJoinRequest = opts?.myJoinRequest ?? null;
  const guestMembership = resolveGroupGuestMembership(userId, offers, {
    myJoinRequest,
    myGuestEscrow: opts?.myGuestEscrow,
    hasOptedOut: opts?.hasOptedOut,
    invitationAccepted: opts?.invitationAccepted,
  });
  const isNegotiable = plan.is_negotiable !== false;
  const joinRequestFlow =
    isNegotiable === false &&
    plan.is_paid &&
    (plan.escrow_pattern === 'B' || plan.escrow_pattern === 'C');

  const isHost = !!userId && plan.creator_id === userId;
  const isGroup = !!plan.is_group_plan;
  const isMood = !!plan.is_mood_plan;
  const isStandard = !isGroup && !isMood;

  const myOffer = findMyLatestOffer(offers, userId);
  const myOfferIsActive = !!myOffer && isOfferLive(myOffer);
  const isJoinApprovedGuest = !isHost && myJoinRequest?.status === 'approved';
  const hasActiveGuestEscrow =
    !!opts?.myGuestEscrow &&
    !!userId &&
    opts.myGuestEscrow.guest_id === userId &&
    opts.myGuestEscrow.status != null &&
    opts.myGuestEscrow.status !== 'cancelled' &&
    opts.myGuestEscrow.status !== 'refunded';
  const guestEscrowFunded =
    !!opts?.myGuestEscrow &&
    !!userId &&
    (opts.myGuestEscrow.guest_funded_at != null ||
      opts.myGuestEscrow.status === 'funded' ||
      opts.myGuestEscrow.status === 'active' ||
      isUserEscrowLegFunded(opts.myGuestEscrow, userId));
  const isMatchedGuest =
    !isHost &&
    (myOffer?.status === 'accepted' ||
      isJoinApprovedGuest ||
      hasActiveGuestEscrow ||
      isConfirmedGroupGuest(guestMembership));
  const isNegotiatingGuest = !isHost && myOfferIsActive && isNegotiable;
  const isBrowsingGuest = !isHost && !isMatchedGuest && !isNegotiatingGuest;

  const acceptedGuests = listAcceptedGuests(offers);
  const acceptedCount = acceptedGuestCount(plan, offers);
  const { lockState, hasOpenSlots } = computePlanLockState(
    plan,
    acceptedCount,
    opts?.availableSlots
  );
  const participationGate = !isHost
    ? resolveGuestParticipationGate(plan, guestMembership, lockState, {
        planExpired,
        availableSlots: opts?.availableSlots,
      })
    : null;

  let showSave = false;
  let showMakeOffer = false;
  let showViewOffer = false;
  let showCalendar = false;
  let showViewAgreement = false;
  let showGroupGuestAgreements = false;
  let showMessage = false;
  let showBoost = false;
  let showInterest = false;
  let showManageOffers = false;
  let showManageRequests = false;
  let showRequestToJoin = false;
  let showViewRequest = false;

  if (!isHost && userId) {
    showSave = true;

    if (isMatchedGuest) {
      showCalendar = true;
      showViewAgreement = true;
      showMessage = true;
    } else if (joinRequestFlow) {
      if (myJoinRequest?.status === 'pending') {
        showViewRequest = true;
      } else if (myJoinRequest?.status === 'approved') {
        if (guestEscrowFunded) {
          showViewAgreement = true;
          showMessage = true;
          showCalendar = true;
        } else {
          showViewAgreement = true;
        }
      } else if (myJoinRequest?.status === 'declined') {
        // Save only
      } else if (participationGate?.canRequest) {
        showRequestToJoin = true;
      }
    } else if (isNegotiatingGuest) {
      showViewOffer = true;
    } else if (isBrowsingGuest && participationGate?.canOffer) {
      showMakeOffer = isNegotiable;
    }
  }

  if (isHost) {
    const hostNegotiating = lockState === 'open';
    const hostGroupPartial = isGroup && lockState === 'partial';

    showBoost = hostNegotiating || hostGroupPartial;
    showInterest = hostNegotiating || hostGroupPartial;

    if (joinRequestFlow) {
      showManageRequests = hostNegotiating || hostGroupPartial;
    } else {
      showManageOffers = hostNegotiating || hostGroupPartial;
    }

    showMessage =
      (!isGroup && lockState === 'full') ||
      (isGroup && (lockState === 'partial' || lockState === 'full'));

    if (isGroup && acceptedGuests.length > 0 && lockState !== 'open') {
      showGroupGuestAgreements = true;
    } else if (!isGroup && lockState === 'full') {
      showViewAgreement = true;
    }
  }

  const showConfirmAttendance =
    isMatchedGuest && plan.status === 'completed' && !completionSelfAcked && !!userId;

  const payShare = resolvePlanPayShareState(plan, userId, opts?.myGuestEscrow, isHost);

  return {
    isHost,
    isMatchedGuest,
    isNegotiatingGuest,
    isBrowsingGuest,
    isStandard,
    isMood,
    isGroup,
    lockState,
    hasOpenSlots,
    myOffer,
    myOfferIsActive,
    showSave,
    showMakeOffer,
    showViewOffer,
    showCalendar,
    showViewAgreement,
    showGroupGuestAgreements,
    showMessage,
    showBoost,
    showInterest,
    showManageOffers,
    showManageRequests,
    showRequestToJoin,
    showViewRequest,
    showConfirmAttendance,
    showPayShare: payShare.showPayShare,
    payShareEscrowId: payShare.payShareEscrowId,
    payShareAmountLabel: payShare.payShareAmountLabel,
    guestMembership,
    guestParticipationBlockReason: participationGate?.blockReason ?? null,
    acceptedGuests,
    isMatchParty: isMatchedGuest || (isHost && lockState !== 'open'),
    userAcceptedOffer: isMatchedGuest ? myOffer : null,
  };
}
