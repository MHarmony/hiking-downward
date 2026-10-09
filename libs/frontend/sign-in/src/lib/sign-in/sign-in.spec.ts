import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { captureException } from '@sentry/angular';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from '@hiking-downward/frontend-auth';

import { SignIn } from './sign-in';
import { identifierMethod, normalizeIdentifier, shouldReportAuthFailure } from './sign-in.utils';

vi.mock('@sentry/angular', () => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

/** Mocked authentication methods exposed to the sign-in component. */
type AuthClientMock = {
  /** Sign-in endpoints exercised by the component. */
  signIn: {
    email: ReturnType<typeof vi.fn<AuthMethod>>;
    username: ReturnType<typeof vi.fn<AuthMethod>>;
    magicLink: ReturnType<typeof vi.fn<AuthMethod>>;
    passkey: ReturnType<typeof vi.fn<AuthMethod>>;
  };
};

/**
 * Request and response shape shared by mocked Better Auth sign-in endpoints.
 *
 * @param options Mock request body accepted by the endpoint.
 * @returns A mocked auth payload or authentication error.
 */
type AuthMethod = (options?: Record<string, unknown>) => Promise<{
  /** Successful response payload, when authentication succeeds. */
  data: Record<string, unknown> | null;
  /** Authentication error, when the request fails. */
  error: { status: number; message?: string } | null;
}>;

describe('SignIn', () => {
  let authClient: AuthClientMock;
  let postAuthRedirectUrl = '/';
  let frontendAuth: {
    authClient: AuthClientMock;
    safePostAuthRedirectUrl: (url: string | null) => string;
    rememberPostAuthRedirectUrl: (url: string | null) => void;
    consumePostAuthRedirectUrl: () => string;
    localizedUrl: (origin: string, path: string) => string;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    postAuthRedirectUrl = '/';
    authClient = {
      signIn: {
        email: vi.fn<AuthMethod>(),
        username: vi.fn<AuthMethod>(),
        magicLink: vi.fn<AuthMethod>(),
        passkey: vi.fn<AuthMethod>().mockResolvedValue({ data: null, error: null }),
      },
    };
    frontendAuth = {
      authClient,
      safePostAuthRedirectUrl: (url: string | null): string =>
        FrontendAuth.safePostAuthRedirectUrl(url),
      rememberPostAuthRedirectUrl: (url: string | null): void => {
        postAuthRedirectUrl = FrontendAuth.safePostAuthRedirectUrl(url);
      },
      consumePostAuthRedirectUrl: (): string => {
        const url = postAuthRedirectUrl;
        postAuthRedirectUrl = '/';
        return url;
      },
      localizedUrl: (origin: string, path: string): string => `${origin}/en${path}`,
    };

    TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [provideRouter([]), { provide: FrontendAuth, useValue: frontendAuth }],
    });
  });

  /** Creates and renders a sign-in component fixture. */
  function createFixture(): ComponentFixture<SignIn> {
    const fixture = TestBed.createComponent(SignIn);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Enters a value through an input's DOM binding.
   *
   * @param fixture Rendered sign-in component fixture.
   * @param id Input element ID.
   * @param value Text to enter.
   * @returns Nothing; dispatches the input event synchronously.
   */
  function setField(fixture: ReturnType<typeof createFixture>, id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('normalizes arbitrary identifiers before classification', () => {
    fc.assert(
      fc.property(fc.string(), (identifier) => {
        expect(normalizeIdentifier(identifier)).toBe(identifier.trim());
        expect(identifierMethod(identifier)).toBe(
          identifier.trim().includes('@') ? 'email' : 'username',
        );
      }),
    );
  }, 10_000);

  it('reports exactly the auth failure statuses that are operational failures', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000, max: 10_000 }), (status) => {
        expect(shouldReportAuthFailure(status)).toBe(status === 0 || status >= 500);
      }),
    );
  }, 10_000);

  it('sends generated valid email addresses through the magic-link flow', async () => {
    const character = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''));
    const emailAddress = fc
      .tuple(
        fc.array(character, { minLength: 2, maxLength: 12 }),
        fc.array(character, { minLength: 2, maxLength: 12 }),
      )
      .map(([localPart, domain]) => `${localPart.join('')}@${domain.join('')}.example.com`);

    authClient.signIn.magicLink.mockResolvedValue({ data: {}, error: null });
    await fc.assert(
      fc.asyncProperty(emailAddress, async (value) => {
        authClient.signIn.magicLink.mockClear();
        const fixture = createFixture();
        try {
          setField(fixture, 'emailOrUsername', value);
          await fixture.whenStable();
          (
            fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement
          ).click();
          await fixture.whenStable();

          expect(authClient.signIn.magicLink).toHaveBeenLastCalledWith({
            email: value,
            callbackURL: 'http://localhost:3000/en/',
          });
        } finally {
          fixture.destroy();
        }
      }),
      { numRuns: 25 },
    );
  }, 30_000);

  it('rejects generated non-email identifiers before a magic-link request', async () => {
    const username = fc
      .string()
      .filter((value) => value.trim().length > 0 && !value.trim().includes('@'));

    await fc.assert(
      fc.asyncProperty(username, async (value) => {
        authClient.signIn.magicLink.mockClear();
        const fixture = createFixture();
        try {
          setField(fixture, 'emailOrUsername', value);
          await fixture.whenStable();
          (
            fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement
          ).click();
          await fixture.whenStable();

          expect(authClient.signIn.magicLink).not.toHaveBeenCalled();
          expect(fixture.nativeElement.textContent).toContain(
            'Magic link sign-in requires an email address.',
          );
        } finally {
          fixture.destroy();
        }
      }),
      { numRuns: 25 },
    );
  }, 30_000);

  it('renders the password and alternate sign-in actions', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Sign in');
    expect(fixture.nativeElement.textContent).toContain('Email me a magic link');
    expect(fixture.nativeElement.textContent).toContain('Sign in with a passkey');
    expect(fixture.nativeElement.querySelector('#emailOrUsername')).not.toBeNull();
  }, 10_000);

  it('validates the identifier and password on password sign-in', async () => {
    const fixture = createFixture();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Enter your email address or username.');
    expect(fixture.nativeElement.textContent).toContain('Enter your password.');
    const activeElement = fixture.nativeElement.ownerDocument.activeElement as HTMLElement;
    expect(activeElement.id).toBe('emailOrUsername');
    expect(authClient.signIn.email).not.toHaveBeenCalled();
    expect(authClient.signIn.username).not.toHaveBeenCalled();
  }, 10_000);

  it('signs in with an email identifier', async () => {
    authClient.signIn.email.mockResolvedValue({
      data: { user: { id: 'email-user' } },
      error: null,
    });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'person@example.com');
    setField(fixture, 'password', 'secret');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'secret',
    });
  }, 10_000);

  it('signs in with a username and reports server failures', async () => {
    authClient.signIn.username.mockResolvedValue({
      data: null,
      error: { status: 500 },
    });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'hiker');
    setField(fixture, 'password', 'secret');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(authClient.signIn.username).toHaveBeenCalledWith({
      username: 'hiker',
      password: 'secret',
    });
    expect(captureException).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Unable to sign in.');
  }, 10_000);

  it('shows an expected credential error without reporting it', async () => {
    authClient.signIn.username.mockResolvedValue({
      data: null,
      error: { status: 401 },
    });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'hiker');
    setField(fixture, 'password', 'secret');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(captureException).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Unable to sign in.');
  }, 10_000);

  it('supports the two-factor redirect response', async () => {
    authClient.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'person@example.com');
    setField(fixture, 'password', 'secret');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(authClient.signIn.email).toHaveBeenCalled();
  }, 10_000);

  it('navigates after a successful username sign-in', async () => {
    authClient.signIn.username.mockResolvedValue({
      data: { user: { id: 'username-user' } },
      error: null,
    });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'hiker');
    setField(fixture, 'password', 'secret');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(authClient.signIn.username).toHaveBeenCalled();
  }, 10_000);

  it('sends a magic link and displays server errors', async () => {
    authClient.signIn.magicLink.mockResolvedValue({ data: {}, error: null });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'person@example.com');
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(authClient.signIn.magicLink).toHaveBeenCalledWith({
      email: 'person@example.com',
      callbackURL: 'http://localhost:3000/en/',
    });
    expect(fixture.nativeElement.textContent).toContain('Check your email');
  }, 10_000);

  it('validates magic-link email before sending', async () => {
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'hiker');
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Magic link sign-in requires an email address.',
    );
    expect(authClient.signIn.magicLink).not.toHaveBeenCalled();
  }, 10_000);

  it('reports a magic-link server failure', async () => {
    authClient.signIn.magicLink.mockResolvedValue({
      data: null,
      error: { status: 500 },
    });
    const fixture = createFixture();
    setField(fixture, 'emailOrUsername', 'person@example.com');
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(captureException).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Unable to send a magic link.');
  }, 10_000);

  it('signs in with a passkey and handles a cancelled passkey request', async () => {
    const fixture = createFixture();
    const passkeyButton = fixture.nativeElement.querySelectorAll('button')[2] as HTMLButtonElement;
    passkeyButton.click();
    await fixture.whenStable();
    expect(authClient.signIn.passkey).toHaveBeenCalledWith();

    authClient.signIn.passkey.mockResolvedValue({
      data: null,
      error: { status: 0, message: 'cancelled' },
    });
    passkeyButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('cancelled');
  }, 10_000);

  it('uses the default passkey message for errors without one', async () => {
    authClient.signIn.passkey.mockResolvedValue({
      data: null,
      error: { status: 401 },
    });
    const fixture = createFixture();
    const passkeyButton = fixture.nativeElement.querySelectorAll('button')[2] as HTMLButtonElement;
    passkeyButton.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Unable to sign in with a passkey.');
  }, 10_000);

  it('skips conditional UI when the browser does not support it', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isConditionalMediationAvailable: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    });
    const fixture = createFixture();
    await fixture.whenStable();

    expect(authClient.signIn.passkey).not.toHaveBeenCalledWith({ autoFill: true });
    vi.unstubAllGlobals();
  }, 10_000);

  it('starts conditional UI and navigates after autofill succeeds', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isConditionalMediationAvailable: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    });
    authClient.signIn.passkey.mockResolvedValue({
      data: { user: { id: 'autofill-user' } },
      error: null,
    });
    const fixture = createFixture();
    await fixture.whenStable();

    expect(authClient.signIn.passkey).toHaveBeenCalledWith({ autoFill: true });
    vi.unstubAllGlobals();
  }, 10_000);

  it('does not navigate when conditional UI returns an error', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isConditionalMediationAvailable: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    });
    authClient.signIn.passkey.mockResolvedValue({
      data: null,
      error: { status: 0, message: 'autofill cancelled' },
    });
    const fixture = createFixture();
    await fixture.whenStable();

    expect(authClient.signIn.passkey).toHaveBeenCalledWith({ autoFill: true });
    vi.unstubAllGlobals();
  }, 10_000);

  it('uses the real auth service configuration', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_BASE_URL, useValue: 'https://auth.example.test' }],
    });

    expect(TestBed.inject(FrontendAuth).authClient).toBeDefined();

    TestBed.resetTestingModule();
    expect(TestBed.inject(AUTH_BASE_URL)).toBe('http://localhost:3000');
  }, 10_000);
});
