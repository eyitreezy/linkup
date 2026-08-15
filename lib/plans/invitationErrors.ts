/** Human-readable invitation expiry label for the invitation screen banner. */
export function invitationExpiryBannerLabel(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60)));
  if (hoursLeft <= 0) return 'Expired';
  return `${hoursLeft}hours`;
}

export function mapInvitationEmailError(code: string): string {
  switch (code) {
    case 'no_slots_available':
      return 'This group plan has no open guest slots right now.';
    case 'invitation_already_exists':
      return 'This email already has an active invitation for this plan.';
    case 'invitations_group_only':
      return 'Invitations are only available for group plans.';
    case 'group_already_closed':
      return 'This group plan is closed to new guests.';
    case 'not_plan_host':
      return 'Only the plan host can send invitations.';
    case 'plan_not_found':
      return 'This plan could not be found.';
    case 'email_failed':
      return 'We could not send the email right now. Please try again shortly.';
    case 'magic_link_failed':
      return 'We could not create the invitation link. Please try again.';
    case 'misconfigured':
      return 'Email invitations are not configured on the server yet.';
    case 'plan_expired':
    case 'PLAN_EXPIRED':
      return 'This plan has already expired, so new invitations cannot be sent.';
    default:
      if (code.includes('duplicate') || code.includes('unique')) {
        return 'This email already has an active invitation for this plan.';
      }
      return 'Please check the email address and try again.';
  }
}

export function mapInvitationRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('could not find the function') || lower.includes('pgrst202')) {
    return 'Invitation service needs a database update. Please try again later.';
  }
  if (lower.includes('kyc') || lower.includes('verif')) {
    return 'KYC_REQUIRED';
  }
  if (lower.includes('expired')) {
    return 'EXPIRED';
  }
  if (lower.includes('no slot') || lower.includes('full')) {
    return 'PLAN_FULL';
  }
  if (lower.includes('not_pending') || lower.includes('already')) {
    return 'ALREADY_RESPONDED';
  }
  if (lower.includes('decline_reason')) {
    return 'DECLINE_REASON_REQUIRED';
  }
  if (lower.includes('not_invitee')) {
    return 'NOT_INVITEE';
  }
  if (lower.includes('not_authenticated')) {
    return 'NOT_AUTHENTICATED';
  }
  if (lower.includes('plan_not_available') || lower.includes('cancelled')) {
    return 'PLAN_UNAVAILABLE';
  }
  return message || 'UNKNOWN_ERROR';
}
