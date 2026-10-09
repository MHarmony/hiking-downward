import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { captureException } from '@sentry/angular';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from '@hiking-downward/frontend-auth';

import { ForgotPassword } from './forgot-password';

vi.mock('@sentry/angular', () => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

/**
 * Mock signature of the Better Auth password reset request method.
 *
 * @param options Request values accepted by the mocked method.
 * @returns A promise containing mocked auth data or an auth error.
 */
type AuthMethod = (options?: Record<string, unknown>) => Promise<{
  data: Record<string, unknown> | null;
  error: { status: number; message?: string } | null;
}>;

/** Better Auth client surface exercised by the forgot-password tests. */
type AuthClientMock = {
  /** Password reset request method. */
  requestPasswordReset: ReturnType<typeof vi.fn<AuthMethod>>;
};

describe('ForgotPassword', () => {
  let authClient: AuthClientMock;

  beforeEach(() => {
    vi.clearAllMocks();
    authClient = {
      requestPasswordReset: vi.fn<AuthMethod>().mockResolvedValue({
        data: { status: true },
        error: null,
      }),
    };
    TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideRouter([]),
        {
          provide: FrontendAuth,
          useValue: {
            authClient,
            localizedUrl: (origin: string, path: string): string => `${origin}/en${path}`,
          },
        },
      ],
    });
  });

  /**
   * Creates a rendered forgot-password component fixture.
   *
   * @returns The initialized component fixture.
   */
  function createFixture(): ComponentFixture<ForgotPassword> {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Enters an email address through the input's DOM binding.
   *
   * @param fixture The component fixture containing the input.
   * @param value The email address to enter.
   */
  function setEmail(fixture: ComponentFixture<ForgotPassword>, value: string): void {
    const input = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Submits the form and waits for Angular to stabilize.
   *
   * @param fixture The component fixture containing the form.
   * @returns A promise that settles when form processing is stable.
   */
  async function submitForm(fixture: ComponentFixture<ForgotPassword>): Promise<void> {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  it('requests resets for generated email addresses in normalized form', async () => {
    const character = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''));
    const emailAddress = fc
      .tuple(
        fc.array(character, { minLength: 2, maxLength: 12 }),
        fc.array(character, { minLength: 2, maxLength: 12 }),
      )
      .map(([localPart, domain]) => `${localPart.join('')}@${domain.join('')}.example.com`);

    await fc.assert(
      fc.asyncProperty(emailAddress, async (value) => {
        authClient.requestPasswordReset.mockClear();
        const fixture = createFixture();
        try {
          setEmail(fixture, `  ${value.toUpperCase()}  `);
          await submitForm(fixture);

          expect(authClient.requestPasswordReset).toHaveBeenLastCalledWith({
            email: value,
            redirectTo: 'http://localhost:3000/en/reset-password',
          });
        } finally {
          fixture.destroy();
        }
      }),
      { numRuns: 25 },
    );
  }, 30_000);

  it('renders the reset request form', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Reset your password');
    expect(text).toContain('Send reset link');
    expect(text).toContain('Back to sign in');
    expect(fixture.nativeElement.querySelector('#email')).not.toBeNull();
  }, 10_000);

  it('validates the email address before requesting a reset', async () => {
    const fixture = createFixture();
    await submitForm(fixture);

    const input = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    expect(fixture.nativeElement.textContent).toContain('Enter your email address.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    expect(fixture.nativeElement.ownerDocument.activeElement).toBe(input);

    setEmail(fixture, 'not-an-email');
    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(authClient.requestPasswordReset).not.toHaveBeenCalled();
  }, 10_000);

  it('confirms the request without revealing whether the account exists', async () => {
    const fixture = createFixture();
    setEmail(fixture, 'hiker@example.com');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain(
      'If an account exists for hiker@example.com, we sent it a password reset link.',
    );
  }, 10_000);

  it('shows expected request errors without reporting them', async () => {
    authClient.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { status: 429, message: 'Too many requests' },
    });
    const fixture = createFixture();
    setEmail(fixture, 'hiker@example.com');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Too many requests');
    expect(fixture.nativeElement.textContent).not.toContain('If an account exists');
    expect(captureException).not.toHaveBeenCalled();
  }, 10_000);

  it('reports operational request failures', async () => {
    authClient.requestPasswordReset.mockResolvedValue({ data: null, error: { status: 500 } });
    const fixture = createFixture();
    setEmail(fixture, 'hiker@example.com');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Unable to send a password reset link.');
    expect(captureException).toHaveBeenCalledOnce();

    authClient.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { status: 0, message: 'offline' },
    });
    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain('offline');
    expect(captureException).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('uses the configured auth service base URL', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_BASE_URL, useValue: 'https://auth.example.test' }],
    });

    expect(TestBed.inject(FrontendAuth).authClient).toBeDefined();

    TestBed.resetTestingModule();
    expect(TestBed.inject(AUTH_BASE_URL)).toBe('http://localhost:3000');
  }, 10_000);
});
