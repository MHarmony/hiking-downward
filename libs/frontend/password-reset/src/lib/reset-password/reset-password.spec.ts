import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { captureException } from '@sentry/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FrontendAuth } from '@hiking-downward/frontend-auth';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../password-reset.utils';
import { ResetPassword } from './reset-password';

vi.mock('@sentry/angular', () => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

/**
 * Mock signature of the Better Auth password reset method.
 *
 * @param options Request values accepted by the mocked method.
 * @returns A promise containing mocked auth data or an auth error.
 */
type AuthMethod = (options?: Record<string, unknown>) => Promise<{
  data: Record<string, unknown> | null;
  error: { status: number; message?: string } | null;
}>;

/** Better Auth client surface exercised by the reset-password tests. */
type AuthClientMock = {
  /** Password reset method. */
  resetPassword: ReturnType<typeof vi.fn<AuthMethod>>;
};

describe('ResetPassword', () => {
  let authClient: AuthClientMock;

  beforeEach(() => {
    vi.clearAllMocks();
    authClient = {
      resetPassword: vi.fn<AuthMethod>().mockResolvedValue({
        data: { status: true },
        error: null,
      }),
    };
  });

  /**
   * Creates a rendered reset-password fixture for the given reset link query parameters.
   *
   * @param queryParams Query parameters Better Auth appended to the reset link redirect.
   * @returns The initialized component fixture.
   */
  function createFixture(queryParams: Record<string, string>): ComponentFixture<ResetPassword> {
    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideRouter([]),
        { provide: FrontendAuth, useValue: { authClient } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Updates a password input through its DOM binding.
   *
   * @param fixture The component fixture containing the input.
   * @param id The DOM identifier of the input to update.
   * @param value The value to enter.
   */
  function setField(fixture: ComponentFixture<ResetPassword>, id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Submits the reset form and waits for Angular to stabilize.
   *
   * @param fixture The component fixture containing the form.
   * @returns A promise that settles when form processing is stable.
   */
  async function submitForm(fixture: ComponentFixture<ResetPassword>): Promise<void> {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  it.each<{ name: string; queryParams: Record<string, string> }>([
    { name: 'no token', queryParams: {} },
    { name: 'an error', queryParams: { error: 'INVALID_TOKEN' } },
    { name: 'a token and an error', queryParams: { token: 'reset-token', error: 'INVALID_TOKEN' } },
  ])(
    'shows an invalid-link message for a link with $name',
    async ({ queryParams }) => {
      const fixture = createFixture(queryParams);
      await fixture.whenStable();
      const text = fixture.nativeElement.textContent as string;

      expect(text).toContain('This password reset link is invalid or has expired.');
      expect(text).toContain('Request a new reset link');
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe(
        '/forgot-password',
      );
    },
    10_000,
  );

  it('renders the new password form for a usable link', async () => {
    const fixture = createFixture({ token: 'reset-token' });
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Choose a new password');
    expect(text).toContain('Reset password');
    expect(text).toContain('Back to sign in');
    expect(fixture.nativeElement.querySelector('#password')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#passwordConfirmation')).not.toBeNull();
  }, 10_000);

  it('validates required fields and focuses the first invalid field', async () => {
    const fixture = createFixture({ token: 'reset-token' });
    await submitForm(fixture);

    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    expect(fixture.nativeElement.textContent).toContain('Enter a new password.');
    expect(fixture.nativeElement.textContent).toContain('Confirm your new password.');
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(password.getAttribute('aria-describedby')).toBe('password-error');
    expect(fixture.nativeElement.ownerDocument.activeElement).toBe(password);
    expect(authClient.resetPassword).not.toHaveBeenCalled();
  }, 10_000);

  it('enforces the password policy and confirmation match', async () => {
    const fixture = createFixture({ token: 'reset-token' });
    setField(fixture, 'password', 'short');
    setField(fixture, 'passwordConfirmation', 'different');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
    expect(fixture.nativeElement.textContent).toContain('Passwords must match.');

    const tooLong = 'x'.repeat(MAX_PASSWORD_LENGTH + 1);
    setField(fixture, 'password', tooLong);
    setField(fixture, 'passwordConfirmation', tooLong);
    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain(
      `Password must be no more than ${MAX_PASSWORD_LENGTH} characters.`,
    );
    expect(authClient.resetPassword).not.toHaveBeenCalled();
  }, 10_000);

  it('resets the password and links to sign in', async () => {
    const fixture = createFixture({ token: 'reset-token' });
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'correct horse');
    await submitForm(fixture);

    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: 'correct horse',
      token: 'reset-token',
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Your password has been reset. Sign in with your new password.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    const signInLink = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect((signInLink.textContent ?? '').trim()).toBe('Sign in');
    expect(signInLink.getAttribute('href')).toBe('/sign-in');
  }, 10_000);

  it('shows expected reset errors without reporting them', async () => {
    authClient.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, message: 'Invalid token' },
    });
    const fixture = createFixture({ token: 'expired-token' });
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'correct horse');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Invalid token');
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(captureException).not.toHaveBeenCalled();
  }, 10_000);

  it('reports operational reset failures', async () => {
    authClient.resetPassword.mockResolvedValue({ data: null, error: { status: 503 } });
    const fixture = createFixture({ token: 'reset-token' });
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'correct horse');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Unable to reset your password.');
    expect(captureException).toHaveBeenCalledOnce();

    authClient.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 0, message: 'offline' },
    });
    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain('offline');
    expect(captureException).toHaveBeenCalledTimes(2);
  }, 10_000);
});
