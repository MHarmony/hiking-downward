import { apiConfig, getEmailConfig } from '@seahawk/api-config';
import { Resend } from 'resend';

const emailConfig = getEmailConfig();
const resend = new Resend(emailConfig.resendApiKey);
const sender = emailConfig.sender;
const appUrl = apiConfig.frontendUrl;

/**
 * Describes the call-to-action link included in a transactional email.
 *
 * @property {string} label Text displayed in the call-to-action link.
 * @property {string} url Destination URL opened by the call-to-action link.
 */
type EmailAction = {
  /** Text displayed in the call-to-action link. */
  label: string;
  /** Destination URL opened by the call-to-action link. */
  url: string;
};

/**
 * Contains the content and delivery options for a transactional email.
 *
 * @property {string} body Main message displayed in the HTML email.
 * @property {string} heading Main heading displayed in the HTML email.
 * @property {string} preview Preview text shown by email clients.
 * @property {string} subject Subject line used for the email.
 * @property {string} textBody Plain-text version of the email content.
 * @property {string} to Recipient email address.
 * @property {EmailAction} [action] Optional call-to-action link.
 * @property {string} [idempotencyKey] Optional key for repeated send requests.
 */
type TransactionalEmail = {
  /** Main message displayed in the HTML email. */
  body: string;
  /** Main heading displayed in the HTML email. */
  heading: string;
  /** Preview text shown by email clients before the message is opened. */
  preview: string;
  /** Subject line used for the email. */
  subject: string;
  /** Plain-text version of the email content. */
  textBody: string;
  /** Recipient email address. */
  to: string;
  /** Optional call-to-action link displayed in the HTML email. */
  action?: EmailAction;
  /** Optional key used to make repeated send requests idempotent. */
  idempotencyKey?: string;
};

/**
 * Escapes user-controlled text before it is interpolated into HTML.
 *
 * @param value Text to escape for safe HTML interpolation.
 * @returns The escaped text.
 */
function escapeHtml(value: string): string {
  const escapedCharacters: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  };

  return value.replace(/[&<>'"]/g, (character) => String(escapedCharacters[character]));
}

/**
 * Renders a transactional email as a complete HTML document.
 *
 * @param body Main message displayed in the HTML email.
 * @param heading Main heading displayed in the HTML email.
 * @param preview Preview text shown by email clients before the message is opened.
 * @param action Optional call-to-action link to include in the HTML email.
 * @returns A complete HTML document for the transactional email.
 */
function renderHtml({
  body,
  heading,
  preview,
  action,
}: Omit<TransactionalEmail, 'textBody' | 'to'>): string {
  const safeBody = escapeHtml(body);
  const safeHeading = escapeHtml(heading);
  const safePreview = escapeHtml(preview);
  const button = action
    ? `<a href="${escapeHtml(action.url)}" style="display:inline-block;background:#075e54;color:#ffffff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700;outline:3px solid #18312f;outline-offset:3px;">${escapeHtml(action.label)}</a>`
    : '';

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7f6;color:#18312f;font-family:Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreview}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d9e5e2;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 32px;background:#18312f;color:#ffffff;font-size:20px;font-weight:700;">HikingDownward</td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#18312f;">${safeHeading}</h1>
            <p style="margin:0 0 26px;font-size:16px;line-height:1.6;">${safeBody}</p>
            ${button ? `<p style="margin:0 0 26px;">${button}</p>` : ''}
            <p style="margin:0;color:#3f5752;font-size:13px;line-height:1.5;">If you did not request this email, you can safely ignore it.</p>
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f4f7f6;color:#3f5752;font-size:12px;line-height:1.5;">HikingDownward · <a href="${escapeHtml(appUrl)}" style="color:#075e54;">Visit the app</a></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Sends a transactional email through Resend.
 *
 * @param email Content and delivery options for the transactional email.
 * @returns A promise that resolves after Resend accepts the email.
 * @throws An error when Resend reports a failure while sending the email.
 */
export async function sendTransactionalEmail(email: TransactionalEmail): Promise<void> {
  const { error } = await resend.emails.send(
    {
      from: sender,
      to: [email.to],
      subject: email.subject,
      html: renderHtml(email),
      text: email.textBody,
    },
    email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : {},
  );

  if (error) {
    /* oxlint-disable-next-line no-console */
    console.error('Transactional email delivery failed', {
      message: error.message,
      subject: email.subject,
    });
    throw new Error(`Unable to send email: ${error.message}`);
  }
}

export { appUrl };
