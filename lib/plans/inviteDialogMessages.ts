/** User-facing invitation send dialogs (mobile). No em or en dashes in copy. */

export type InviteDelivery = 'email' | 'in_app';

export function inviteSuccessAlertContent(
  email?: string,
  delivery: InviteDelivery = email ? 'email' : 'in_app',
  emailSent = true,
  emailError?: string
): { title: string; message: string } {
  if (delivery === 'in_app') {
    return {
      title: 'Invitation sent',
      message: 'They already use LinkUp and were notified in the app.',
    };
  }
  if (email && emailSent === false) {
    if (emailError === 'domain_not_verified') {
      return {
        title: 'Invitation saved',
        message:
          'The invitation was saved, but email delivery is not set up yet. Verify your sending domain in Resend, then try again.',
      };
    }
    return {
      title: 'Invitation saved',
      message:
        'The invitation was saved, but the email could not be sent. Retry from Sent invitations after checking your email setup.',
    };
  }
  if (email) {
    return {
      title: 'Invitation sent',
      message: `An invitation email was sent to ${email}. Ask them to check spam if it does not arrive soon.`,
    };
  }
  return {
    title: 'Invitation sent',
    message: 'Your invitation email is on its way.',
  };
}
