import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const noValue = null as never;

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.stubEnv('RESEND_API_KEY', 're_test-key');

vi.mock('resend', () => ({
  Resend: class {
    public emails = { send: sendMock };
  },
}));

import { sendTransactionalEmail } from './email';

describe('sendTransactionalEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  it('sends escaped HTML and plain text with an action and idempotency key', async () => {
    await sendTransactionalEmail({
      body: 'Body & <details>',
      heading: 'Heading "quoted"',
      preview: "Preview's text",
      subject: 'Subject',
      textBody: 'Plain text',
      to: 'person@example.com',
      action: { label: 'Continue >', url: 'https://example.com/?a=1&b=2' },
      idempotencyKey: 'email-event/token',
    });

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'HikingDownward <no-reply@mharmony.io>',
        to: ['person@example.com'],
        subject: 'Subject',
        text: 'Plain text',
        html: expect.stringContaining('Body &amp; &lt;details&gt;'),
      }),
      { idempotencyKey: 'email-event/token' },
    );

    const html = (sendMock.mock.calls[0] as [{ html: string }])[0].html;
    expect(html).toContain('Heading &quot;quoted&quot;');
    expect(html).toContain('Preview&#39;s text');
    expect(html).toContain('Continue &gt;');
    expect(html).toContain('https://example.com/?a=1&amp;b=2');
    expect(html).not.toContain('Body & <details>');
  }, 10_000);

  it('sends a notification without an action or idempotency key', async () => {
    await sendTransactionalEmail({
      body: 'Notification',
      heading: 'Account notification',
      preview: 'A notification',
      subject: 'Notification',
      textBody: 'Plain notification',
      to: 'person@example.com',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.not.stringContaining('Sign in securely') }),
      {},
    );
  }, 10_000);

  it('throws when Resend returns an error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => noValue);
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'Rejected by Resend' } });

    await expect(
      sendTransactionalEmail({
        body: 'Body',
        heading: 'Heading',
        preview: 'Preview',
        subject: 'Subject',
        textBody: 'Text',
        to: 'person@example.com',
      }),
    ).rejects.toThrow('Unable to send email: Rejected by Resend');
    expect(errorSpy).toHaveBeenCalledWith('Transactional email delivery failed', {
      message: 'Rejected by Resend',
      subject: 'Subject',
    });
    errorSpy.mockRestore();
  }, 10_000);

  it('escapes arbitrary content in every HTML interpolation', async () => {
    const contentArbitrary = fc.string().map((value) => `${value}&<>'"`);
    const escapeHtml = (value: string): string =>
      value.replace(/[&<>'"]/g, (character) => {
        const escapedCharacters: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        };
        return escapedCharacters[character] ?? character;
      });

    await fc.assert(
      fc.asyncProperty(
        contentArbitrary,
        contentArbitrary,
        contentArbitrary,
        contentArbitrary,
        contentArbitrary,
        async (body, heading, preview, label, url) => {
          await sendTransactionalEmail({
            body,
            heading,
            preview,
            subject: 'Subject',
            textBody: 'Text',
            to: 'person@example.com',
            action: { label, url },
          });

          const html = (sendMock.mock.calls.at(-1) as [{ html: string }])[0].html;
          expect(html).toContain(escapeHtml(body));
          expect(html).toContain(escapeHtml(heading));
          expect(html).toContain(escapeHtml(preview));
          expect(html).toContain(escapeHtml(label));
          expect(html).toContain(escapeHtml(url));
        },
      ),
    );
  }, 10_000);
});
