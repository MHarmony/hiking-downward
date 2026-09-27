import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { captureException } from '@sentry/angular';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from '@hiking-downward/frontend-auth';

import { SignUp } from './sign-up';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  passwordsMatch,
} from './sign-up.utils';

vi.mock('@sentry/angular', () => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

/**
 * Mock signature shared by the Better Auth registration methods.
 *
 * @param options Optional request values accepted by the mocked method.
 * @returns A promise containing mocked auth data or an auth error.
 */
type AuthMethod = (options?: Record<string, unknown>) => Promise<{
  data: Record<string, unknown> | null;
  error: { status: number; message?: string } | null;
}>;

/** Better Auth client surface exercised by the sign-up component tests. */
type AuthClientMock = {
  /** Password registration methods. */
  signUp: { email: ReturnType<typeof vi.fn<AuthMethod>> };
  /** Magic-link registration methods. */
  signIn: { magicLink: ReturnType<typeof vi.fn<AuthMethod>> };
};

describe('SignUp', () => {
  let authClient: AuthClientMock;

  beforeEach(() => {
    vi.clearAllMocks();
    authClient = {
      signUp: { email: vi.fn<AuthMethod>() },
      signIn: { magicLink: vi.fn<AuthMethod>() },
    };
    TestBed.configureTestingModule({
      imports: [SignUp],
      providers: [provideRouter([]), { provide: FrontendAuth, useValue: { authClient } }],
    });
  });

  /**
   * Creates a rendered sign-up component fixture.
   *
   * @returns The initialized component fixture.
   * @throws When Angular cannot create or render the component.
   */
  function createFixture(): ComponentFixture<SignUp> {
    const fixture = TestBed.createComponent(SignUp);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Updates a sign-up input through its DOM binding.
   *
   * @param fixture The component fixture containing the input.
   * @param id The DOM identifier of the input to update.
   * @param value The value to enter into the input.
   * @throws When no input exists for the supplied identifier.
   */
  function setField(fixture: ComponentFixture<SignUp>, id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Submits the password registration form and waits for Angular to stabilize.
   *
   * @param fixture The component fixture containing the form.
   * @returns A promise that settles when form processing is stable.
   * @throws When the form is absent or form processing rejects.
   */
  async function submitPasswordForm(fixture: ComponentFixture<SignUp>): Promise<void> {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  it('normalizes arbitrary email input', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(normalizeEmail(value)).toBe(value.trim().toLowerCase());
      }),
    );
  }, 10_000);

  it('checks arbitrary password confirmations', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (password, confirmation) => {
        expect(passwordsMatch(password, confirmation)).toBe(password === confirmation);
      }),
    );
  }, 10_000);

  it('renders registration controls', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Create your account');
    expect(fixture.nativeElement.querySelector('#email')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#password')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#passwordConfirmation')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Email me a sign-up link');
  }, 10_000);

  it('validates required fields and focuses the first invalid field', async () => {
    const fixture = createFixture();
    await submitPasswordForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Enter your email address.');
    expect(fixture.nativeElement.textContent).toContain('Enter a password.');
    expect(fixture.nativeElement.textContent).toContain('Confirm your password.');
    expect(fixture.nativeElement.ownerDocument.activeElement.id).toBe('email');
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  }, 10_000);

  it('validates email and password boundaries before registration', async () => {
    const fixture = createFixture();
    setField(fixture, 'email', 'not-an-email');
    setField(fixture, 'password', 'short');
    setField(fixture, 'passwordConfirmation', 'short');
    await submitPasswordForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(fixture.nativeElement.textContent).toContain(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
    expect(authClient.signUp.email).not.toHaveBeenCalled();

    setField(fixture, 'email', 'person@example.com');
    setField(fixture, 'password', 'x'.repeat(MAX_PASSWORD_LENGTH + 1));
    setField(fixture, 'passwordConfirmation', 'x'.repeat(MAX_PASSWORD_LENGTH + 1));
    await submitPasswordForm(fixture);
    expect(fixture.nativeElement.textContent).toContain(
      `Password must be no more than ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }, 10_000);

  it('rejects a mismatched password confirmation', async () => {
    const fixture = createFixture();
    setField(fixture, 'email', 'person@example.com');
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'different horse');
    await submitPasswordForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Passwords must match.');
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  }, 10_000);

  it('normalizes email and signs up successfully', async () => {
    authClient.signUp.email.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
    const fixture = createFixture();
    setField(fixture, 'email', '  PERSON@Example.COM  ');
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'correct horse');
    await submitPasswordForm(fixture);

    expect(authClient.signUp.email).toHaveBeenCalledWith({
      email: 'person@example.com',
      name: 'person@example.com',
      password: 'correct horse',
      callbackURL: 'http://localhost:3000/',
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Check your email. We sent verification instructions to person@example.com.',
    );
  }, 10_000);

  it('shows expected registration errors without reporting them', async () => {
    authClient.signUp.email.mockResolvedValue({
      data: null,
      error: { status: 400, message: 'Email already exists' },
    });
    const fixture = createFixture();
    setField(fixture, 'email', 'person@example.com');
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'correct horse');
    await submitPasswordForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Email already exists');
    expect(captureException).not.toHaveBeenCalled();
  }, 10_000);

  it('reports registration server and network failures', async () => {
    authClient.signUp.email.mockResolvedValue({ data: null, error: { status: 500 } });
    const fixture = createFixture();
    setField(fixture, 'email', 'person@example.com');
    setField(fixture, 'password', 'correct horse');
    setField(fixture, 'passwordConfirmation', 'correct horse');
    await submitPasswordForm(fixture);

    expect(captureException).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Unable to create your account.');

    authClient.signUp.email.mockResolvedValue({
      data: null,
      error: { status: 0, message: 'offline' },
    });
    await submitPasswordForm(fixture);
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('offline');
  }, 10_000);

  it('sends a normalized magic-link registration request', async () => {
    authClient.signIn.magicLink.mockResolvedValue({ data: {}, error: null });
    const fixture = createFixture();
    setField(fixture, 'email', '  PERSON@Example.COM  ');
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(authClient.signIn.magicLink).toHaveBeenCalledWith({
      email: 'person@example.com',
      name: 'person@example.com',
      callbackURL: 'http://localhost:3000/',
      newUserCallbackURL: 'http://localhost:3000/sign-up/complete',
    });
    expect(fixture.nativeElement.textContent).toContain('person@example.com');
  }, 10_000);

  it('validates the magic-link email before sending', async () => {
    const fixture = createFixture();
    setField(fixture, 'email', 'not-an-email');
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(authClient.signIn.magicLink).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
  }, 10_000);

  it('handles magic-link expected and operational errors', async () => {
    authClient.signIn.magicLink.mockResolvedValue({
      data: null,
      error: { status: 401, message: 'Not allowed' },
    });
    const fixture = createFixture();
    setField(fixture, 'email', 'person@example.com');
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Not allowed');
    expect(captureException).not.toHaveBeenCalled();

    authClient.signIn.magicLink.mockResolvedValue({ data: null, error: { status: 500 } });
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(captureException).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Unable to send a sign-up link.');
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
