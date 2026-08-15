/** Branded plan-invitation email (matches Supabase auth templates in linkup repo). */

export const INVITATION_EMAIL_SUBJECT = 'LinkUp: You are invited to a meetup';

export type InvitationEmailParams = {
  hostName: string;
  planName?: string;
  meetType?: string;
  planDate?: string;
  shareAmount?: string;
  magicLink: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:20px;color:#6B7280;width:96px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:20px;color:#1A1D26;font-weight:600;">
        ${escapeHtml(value)}
      </td>
    </tr>`;
}

export function buildInvitationEmailHtml(p: InvitationEmailParams): string {
  const hostName = escapeHtml(p.hostName);
  const planName = escapeHtml(p.planName ?? 'a meetup');
  const magicLink = escapeHtml(p.magicLink);

  const detailRows = [
    p.meetType ? detailRow('Meet type', p.meetType) : '',
    p.planDate ? detailRow('Date', p.planDate) : '',
    p.shareAmount ? detailRow('Your share', p.shareAmount) : '',
  ]
    .filter(Boolean)
    .join('');

  const detailsBlock = detailRows
    ? `
          <tr>
            <td style="padding:0 28px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F8F9FC;border-radius:16px;padding:16px 18px;">
                ${detailRows}
              </table>
            </td>
          </tr>`
    : '';

  return `<div style="margin:0;padding:0;background-color:#F3F0FF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F3F0FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#FFFBFE;border-radius:24px;overflow:hidden;border:1px solid rgba(108,99,255,0.12);box-shadow:0 8px 24px rgba(42,31,85,0.08);">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td height="6" style="background:linear-gradient(90deg,#6C63FF 0%,#8B7CE8 50%,#FF6584 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td align="center" style="padding:28px 28px 8px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;font-weight:800;line-height:1.1;letter-spacing:-0.5px;">
                      <span style="color:#2D1B4E;">link</span><span style="color:#FF6584;">up</span>
                    </p>
                    <p style="margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;line-height:18px;color:#6C63FF;letter-spacing:0.15px;">
                      Meet With Confidence
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;">
              <h2 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:800;line-height:28px;color:#1A1D26;">
                You are invited
              </h2>
              <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:22px;color:#4B5563;">
                <strong style="color:#1A1D26;">${hostName}</strong> invited you to join
                <strong style="color:#1A1D26;">${planName}</strong> on LinkUp.
              </p>
              <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:22px;color:#4B5563;">
                Create your free account to view the plan and respond.
              </p>
            </td>
          </tr>
          ${detailsBlock}
          <tr>
            <td align="center" style="padding:12px 28px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" bgcolor="#6C63FF" style="border-radius:999px;">
                    <a href="${magicLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;">
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:20px;color:#6B7280;">
                If the button does not work, copy this link into your browser:
              </p>
              <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;line-height:16px;word-break:break-all;color:#9CA3AF;">
                <a href="${magicLink}" style="color:#6C63FF;text-decoration:underline;">${magicLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;border-top:1px solid rgba(108,99,255,0.08);">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:18px;color:#9CA3AF;">
                This link expires in 72 hours. If you did not expect this email, you can ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:16px;color:#9CA3AF;">
          LinkUp &middot; Trusted plans and real meetups
        </p>
      </td>
    </tr>
  </table>
</div>`;
}

export function buildInvitationEmailText(p: InvitationEmailParams): string {
  const lines = [
    'You are invited to a meetup on LinkUp',
    '',
    `${p.hostName} invited you to join ${p.planName ?? 'a meetup'}.`,
  ];
  if (p.meetType) lines.push('', `Meet type: ${p.meetType}`);
  if (p.planDate) lines.push(`Date: ${p.planDate}`);
  if (p.shareAmount) lines.push(`Your share: ${p.shareAmount}`);
  lines.push(
    '',
    'Create your free LinkUp account to view the plan and respond.',
    '',
    `Accept invitation: ${p.magicLink}`,
    '',
    'This link expires in 72 hours. If you did not expect this email, you can ignore it.',
    '',
    'LinkUp'
  );
  return lines.join('\n');
}
