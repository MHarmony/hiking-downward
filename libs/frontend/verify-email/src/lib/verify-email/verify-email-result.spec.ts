import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { captureException } from '@sentry/angular';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from '@hiking-downward/frontend-auth';

import { VerifyEmailResult } from './verify-email-result';
import {
  normalizeEmail,
  shouldReportAuthFailure,
  verificationErrorMessage,
} from './verify-email.utils';

vi.mock('@sentry/angular', () => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

/**
 * Mock signature of the Better Auth verification email method.
 *
 * @param options Request values accepted by the mocked method.
 * @returns A promise containing mocked auth data or an auth error.
 */
type AuthMethod = (options?: Record<string, unknown>) => Promise<{
  data: Record<string, unknown> | null;
  error: { status: number; message?: string } | null;
}>;

/** Better Auth client surface exercised by the verification result tests. */
type AuthClientMock = {
  /** Verification email method. */
  sendVerificationEmail: ReturnType<typeof vi.fn<AuthMethod>>;
};

/** Error codes Better Auth appends when an email verification link fails. */
const knownErrorCodes = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'USER_NOT_FOUND']);

describe('VerifyEmailResult', () => {
  let authClient: AuthClientMock;

  beforeEach(() => {
    vi.clearAllMocks();
    authClient = {
      sendVerificationEmail: vi.fn<AuthMethod>().mockResolvedValue({
        data: { status: true },
        error: null,
      }),
    };
  });

  /**
   * Creates a rendered verification result fixture for the given redirect query parameters.
   *
   * @param queryParams Query parameters Better Auth appended to the verification redirect.
   * @returns The initialized component fixture.
   */
  function createFixture(queryParams: Record<string, string>): ComponentFixture<VerifyEmailResult> {
    TestBed.configureTestingModule({
      imports: [VerifyEmailResult],
      providers: [
        provideRouter([]),
        { provide: FrontendAuth, useValue: { authClient } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(VerifyEmailResult);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Enters an email address through the input's DOM binding.
   *
   * @param fixture The component fixture containing the input.
   * @param value The email address to enter.
   */
  function setEmail(fixture: ComponentFixture<VerifyEmailResult>, value: string): void {
    const input = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Submits the resend form and waits for Angular to stabilize.
   *
   * @param fixture The component fixture containing the form.
   * @returns A promise that settles when form processing is stable.
   */
  async function submitForm(fixture: ComponentFixture<VerifyEmailResult>): Promise<void> {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  it('normalizes arbitrary email input idempotently', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeEmail(value);
        expect(normalized).toBe(value.trim().toLowerCase());
        expect(normalizeEmail(normalized)).toBe(normalized);
      }),
    );
  }, 10_000);

  it('explains unknown error codes with the generic message', () => {
    fc.assert(
      fc.property(
        fc.string().filter((code) => !knownErrorCodes.has(code)),
        (code) => {
          expect(verificationErrorMessage(code)).toBe("We couldn't verify your email address.");
        },
      ),
    );
  }, 10_000);

  it('reports exactly the auth failure statuses that are operational failures', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000, max: 10_000 }), (status) => {
        expect(shouldReportAuthFailure(status)).toBe(status === 0 || status >= 500);
      }),
    );
  }, 10_000);

  it('confirms a successful verification and links home', async () => {
    const fixture = createFixture({});
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Your email is verified');
    expect(text).toContain('Thanks for confirming your email address.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect((link.textContent ?? '').trim()).toBe('Continue to HikingDownward');
    expect(link.getAttribute('href')).toBe('/');
  }, 10_000);

  it.each([
    { code: 'TOKEN_EXPIRED', message: 'This verification link has expired.' },
    { code: 'INVALID_TOKEN', message: 'This verification link is invalid.' },
    { code: 'USER_NOT_FOUND', message: "We couldn't find an account for this verification link." },
    { code: 'SOMETHING_ELSE', message: "We couldn't verify your email address." },
  ])(
    'explains the $code failure and offers a new link',
    async ({ code, message }) => {
      const fixture = createFixture({ error: code });
      await fixture.whenStable();
      const text = fixture.nativeElement.textContent as string;

      expect(text).toContain("We couldn't verify your email");
      expect(text).toContain(message);
      expect(text).toContain('Send a new verification link');
      expect(fixture.nativeElement.querySelector('#email')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/sign-in');
    },
    10_000,
  );

  it('validates the email address before resending', async () => {
    const fixture = createFixture({ error: 'TOKEN_EXPIRED' });
    await submitForm(fixture);

    const input = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    expect(fixture.nativeElement.textContent).toContain('Enter your email address.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    expect(fixture.nativeElement.ownerDocument.activeElement).toBe(input);

    setEmail(fixture, 'not-an-email');
    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled();
  }, 10_000);

  it('sends a normalized resend request that returns to this page', async () => {
    const fixture = createFixture({ error: 'TOKEN_EXPIRED' });
    setEmail(fixture, '  HIKER@Example.COM ');
    await submitForm(fixture);

    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'hiker@example.com',
      callbackURL: 'http://localhost:3000/verify-email/result',
    });
    expect(fixture.nativeElement.textContent).toContain(
      'If hiker@example.com needs verification, we sent it a new link.',
    );
  }, 10_000);

  it('shows expected resend errors without reporting them', async () => {
    authClient.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { status: 400, message: 'Email is already verified' },
    });
    const fixture = createFixture({ error: 'INVALID_TOKEN' });
    setEmail(fixture, 'hiker@example.com');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Email is already verified');
    expect(captureException).not.toHaveBeenCalled();
  }, 10_000);

  it('reports operational resend failures', async () => {
    authClient.sendVerificationEmail.mockResolvedValue({ data: null, error: { status: 500 } });
    const fixture = createFixture({ error: 'INVALID_TOKEN' });
    setEmail(fixture, 'hiker@example.com');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Unable to send a verification email.');
    expect(captureException).toHaveBeenCalledOnce();

    authClient.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { status: 0, message: 'offline' },
    });
    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain('offline');
    expect(captureException).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('uses the configured auth service base URL', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_BASE_URL, useValue: 'https://auth.example.test' }],
    });

    expect(TestBed.inject(FrontendAuth).authClient).toBeDefined();

    TestBed.resetTestingModule();
    expect(TestBed.inject(AUTH_BASE_URL)).toBe('http://localhost:3000');
  }, 10_000);
});
