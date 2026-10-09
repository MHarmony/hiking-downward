import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SecuritySettings } from './security-settings';

/** Auth response shape shared by SecuritySettings test doubles. */
type AuthResult = {
  /** Successful response data, when present. */
  data: unknown;
  /** Auth error, when present. */
  error: { message?: string } | null;
};

/** State shape emitted by the passkey query mock. */
type PasskeyState = {
  /** Loaded passkeys or no data. */
  data: Array<{ id: string; name: string; createdAt: Date }> | null;
  /** Query error; the fixture uses successful query states. */
  error: null;
  /** Whether the query is initially loading. */
  isPending: boolean;
  /** Whether the query is refreshing. */
  isRefetching: boolean;
  /** Refreshes the mocked passkey list. */
  refetch: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

const { qrcodeMock } = vi.hoisted(() => ({
  qrcodeMock: vi.fn<() => string>(),
}));

vi.mock('etiket/qr', () => ({ qrcodeDataURI: qrcodeMock }));

describe('SecuritySettings', () => {
  let fixture: ComponentFixture<SecuritySettings>;
  let authClient: Record<string, unknown>;
  let getSession: ReturnType<typeof vi.fn<() => Promise<AuthResult>>>;
  let changeEmail: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>
  >;
  let changePassword: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>
  >;
  let requestPasswordReset: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>
  >;
  let enableTwoFactor: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>
  >;
  let verifyTotp: ReturnType<typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>>;
  let disableTwoFactor: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>
  >;
  let generateBackupCodes: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<AuthResult>>
  >;
  let listSessions: ReturnType<typeof vi.fn<() => Promise<AuthResult>>>;
  let revokeSession: ReturnType<typeof vi.fn<(input: { token: string }) => Promise<AuthResult>>>;
  let revokeOtherSessions: ReturnType<typeof vi.fn<() => Promise<AuthResult>>>;
  let addPasskey: ReturnType<typeof vi.fn<(options?: { name?: string }) => Promise<AuthResult>>>;
  let passkeyFetch: ReturnType<
    typeof vi.fn<
      (
        path: string,
        options: { method: string; body: Record<string, unknown> },
      ) => Promise<AuthResult>
    >
  >;
  let passkeyState: PasskeyState;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    qrcodeMock.mockReset().mockReturnValue('data:image/svg+xml;base64,qr');
    getSession = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: true, twoFactorEnabled: false },
      },
      error: null,
    });
    changeEmail = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({
        data: { status: true },
        error: null,
      });
    changePassword = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { status: true }, error: null });
    requestPasswordReset = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { status: true }, error: null });
    enableTwoFactor = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({
        data: {
          method: 'totp',
          totpURI: 'otpauth://totp/HikingDownward?secret=TESTSECRET&issuer=HikingDownward',
          backupCodes: ['BACKUP-ONE', 'BACKUP-TWO'],
        },
        error: null,
      });
    verifyTotp = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { status: true }, error: null });
    disableTwoFactor = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { status: true }, error: null });
    generateBackupCodes = vi
      .fn<(input: Record<string, unknown>) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { backupCodes: ['NEW-ONE', 'NEW-TWO'] }, error: null });
    listSessions = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({
      data: [
        {
          id: 'current-session',
          token: 'current-session-secret',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: new Date('2026-01-08T00:00:00Z'),
          ipAddress: '203.0.113.9',
          userAgent: '',
        },
        {
          id: 'other-session',
          token: 'other-session-secret',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          expiresAt: new Date('2026-01-09T00:00:00Z'),
          userAgent: 'Other Browser',
        },
      ],
      error: null,
    });
    revokeSession = vi
      .fn<(input: { token: string }) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { status: true }, error: null });
    revokeOtherSessions = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({
      data: { status: true },
      error: null,
    });
    addPasskey = vi
      .fn<(options?: { name?: string }) => Promise<AuthResult>>()
      .mockResolvedValue({ data: { id: 'new-passkey' }, error: null });
    passkeyState = {
      data: [],
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn<() => Promise<void>>().mockImplementation(async () => Promise.resolve()),
    };
    const passkeyQuery = {
      get: vi.fn<() => PasskeyState>(() => passkeyState),
      subscribe: vi.fn<(subscriber: (state: PasskeyState) => void) => () => void>((subscriber) => {
        subscriber(passkeyState);
        return vi.fn<() => void>();
      }),
    };
    passkeyFetch = vi
      .fn<
        (
          path: string,
          options: { method: string; body: Record<string, unknown> },
        ) => Promise<AuthResult>
      >()
      .mockResolvedValue({ data: { status: true }, error: null });
    authClient = {
      getSession,
      changeEmail,
      changePassword,
      requestPasswordReset,
      twoFactor: {
        enable: enableTwoFactor,
        verifyTotp,
        disable: disableTwoFactor,
        generateBackupCodes,
      },
      useListPasskeys: passkeyQuery,
      passkey: {
        addPasskey,
      },
      $fetch: passkeyFetch,
      listSessions,
      revokeSession,
      revokeOtherSessions,
    };
    TestBed.configureTestingModule({
      imports: [SecuritySettings],
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

  /** Creates and renders a security-settings fixture. */
  function createFixture(): ComponentFixture<SecuritySettings> {
    const createdFixture = TestBed.createComponent(SecuritySettings);
    createdFixture.detectChanges();
    return createdFixture;
  }

  /**
   * Waits until the initial security-state load has finished.
   *
   * @returns A promise settling when the loading message is removed.
   */
  async function waitForInitialLoad(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Loading security settings…');
    });
  }

  it('loads security status and never renders session tokens', async () => {
    fixture = createFixture();
    expect(fixture.nativeElement.textContent).toContain('Loading security settings…');
    await waitForInitialLoad();

    expect(fixture.nativeElement.textContent).toContain('hiker@example.com');
    expect(fixture.nativeElement.textContent).toContain('Verified');
    expect(fixture.nativeElement.textContent).toContain('Browser session');
    expect(fixture.nativeElement.textContent).toContain('This device');
    expect(fixture.nativeElement.textContent).toContain('203.0.113.9');
    expect(fixture.nativeElement.textContent).not.toContain('current-session-secret');
    expect(fixture.nativeElement.textContent).not.toContain('other-session-secret');
  }, 10_000);

  it('uses empty defaults when the session response or passkey list has no data', async () => {
    getSession.mockResolvedValueOnce({ data: null, error: null });
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');

    fixture.destroy();
    getSession.mockResolvedValueOnce({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: false },
      },
      error: null,
    });
    passkeyState.data = null;
    listSessions.mockResolvedValueOnce({ data: null, error: null });
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('No active sessions found.');
    expect(fixture.nativeElement.textContent).toContain('Not verified');
  }, 10_000);

  it('handles a rejected session request during initial load', async () => {
    getSession.mockRejectedValueOnce(new Error('Session request failed.'));
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');
    expect(listSessions).not.toHaveBeenCalled();
  }, 10_000);

  it('handles missing sessions and passkey query failures', async () => {
    getSession.mockResolvedValueOnce({ data: null, error: null });
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');

    fixture.destroy();
    getSession.mockResolvedValueOnce({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: true, twoFactorEnabled: false },
      },
      error: null,
    });
    passkeyState.refetch.mockRejectedValueOnce(new Error('Passkey list unavailable.'));
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');
  }, 10_000);

  it('handles rejected session, session-list, and passkey-list requests', async () => {
    getSession.mockRejectedValueOnce(new Error('Session unavailable.'));
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');

    fixture.destroy();
    getSession.mockResolvedValueOnce({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: true, twoFactorEnabled: false },
      },
      error: null,
    });
    listSessions.mockRejectedValueOnce(new Error('Session list unavailable.'));
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load active sessions.');

    fixture.destroy();
    getSession.mockResolvedValueOnce({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: true, twoFactorEnabled: false },
      },
      error: null,
    });
    listSessions.mockResolvedValueOnce({ data: [], error: null });
    passkeyState.refetch.mockRejectedValueOnce(new Error('Passkey list unavailable.'));
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');
  }, 10_000);

  it('shows an empty state when no sessions or passkeys are registered', async () => {
    listSessions.mockResolvedValueOnce({ data: [], error: null });
    vi.stubGlobal('PublicKeyCredential', class {});
    vi.stubGlobal('isSecureContext', true);
    fixture = createFixture();
    await waitForInitialLoad();

    expect(fixture.nativeElement.textContent).toContain('No active sessions found.');
    expect(fixture.nativeElement.textContent).toContain('No passkeys are registered.');
  }, 10_000);

  it('shows an error when the session list endpoint rejects', async () => {
    listSessions.mockRejectedValueOnce(new Error('Session service unavailable.'));
    fixture = createFixture();
    await waitForInitialLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load active sessions.');
  }, 10_000);

  it('shows a loading error when the current session is missing', async () => {
    getSession.mockResolvedValueOnce({ data: null, error: null });
    fixture = createFixture();
    await waitForInitialLoad();

    expect(fixture.nativeElement.textContent).toContain('Unable to load security settings.');
    expect(listSessions).not.toHaveBeenCalled();
  }, 10_000);

  it('shows an error when active sessions cannot be loaded', async () => {
    listSessions.mockResolvedValueOnce({
      data: null,
      error: { message: 'Session list unavailable.' },
    });
    fixture = createFixture();
    await waitForInitialLoad();

    expect(fixture.nativeElement.textContent).toContain('Session list unavailable.');
  }, 10_000);

  it('shows an empty state when there are no active sessions', async () => {
    listSessions.mockResolvedValueOnce({ data: [], error: null });
    fixture = createFixture();
    await waitForInitialLoad();

    expect(fixture.nativeElement.textContent).toContain('No active sessions found.');
  }, 10_000);

  it('requests a verified email change and reports the current inbox', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const emailInput = fixture.nativeElement.querySelector('#new-email') as HTMLInputElement;
    emailInput.value = 'new@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(changeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        newEmail: 'new@example.com',
        callbackURL: expect.stringContaining('/en/settings/security'),
      }),
    );
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'hiker@example.com',
    );
  }, 10_000);

  it('rejects invalid email addresses before requesting a change', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const emailInput = fixture.nativeElement.querySelector('#new-email') as HTMLInputElement;
    emailInput.value = 'not-an-email';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(changeEmail).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
  }, 10_000);

  it('shows email-change server errors', async () => {
    changeEmail.mockResolvedValueOnce({ data: null, error: { message: 'Email already in use.' } });
    fixture = createFixture();
    await waitForInitialLoad();
    const emailInput = fixture.nativeElement.querySelector('#new-email') as HTMLInputElement;
    emailInput.value = 'new@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Email already in use.');
  }, 10_000);

  it('shows a generic email-change error when the request rejects', async () => {
    changeEmail.mockRejectedValueOnce(new Error('Network unavailable.'));
    fixture = createFixture();
    await waitForInitialLoad();
    const emailInput = fixture.nativeElement.querySelector('#new-email') as HTMLInputElement;
    emailInput.value = 'new@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('The request could not be completed.');
  }, 10_000);

  it('changes passwords and requests a reset link for passwordless accounts', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const fill = (selector: string, value: string): void => {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('#current-password', 'current-password');
    fill('#new-password', 'new-password-123');
    fill('#confirm-password', 'new-password-123');
    fixture.detectChanges();
    fixture.nativeElement
      .querySelectorAll('form')[1]
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'current-password',
      newPassword: 'new-password-123',
      revokeOtherSessions: true,
    });
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'hiker@example.com',
        redirectTo: expect.stringContaining('/en/reset-password'),
      }),
    );
  }, 10_000);

  it('rejects mismatched password confirmation without making an API request', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const values: Record<string, string> = {
      '#current-password': 'current-password',
      '#new-password': 'new-password-123',
      '#confirm-password': 'different-password',
    };
    for (const [selector, value] of Object.entries(values)) {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fixture.detectChanges();
    fixture.nativeElement
      .querySelectorAll('form')[1]
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(changePassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Passwords must match.');
  }, 10_000);

  it('shows password-change API errors', async () => {
    changePassword.mockResolvedValueOnce({ data: null, error: { message: 'Incorrect password.' } });
    fixture = createFixture();
    await waitForInitialLoad();
    const values: Record<string, string> = {
      '#current-password': 'wrong-password',
      '#new-password': 'new-password-123',
      '#confirm-password': 'new-password-123',
    };
    for (const [selector, value] of Object.entries(values)) {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fixture.detectChanges();
    fixture.nativeElement
      .querySelectorAll('form')[1]
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Incorrect password.');
  }, 10_000);

  it('shows password-reset request errors', async () => {
    requestPasswordReset.mockResolvedValueOnce({ data: null, error: { message: 'Email failed.' } });
    fixture = createFixture();
    await waitForInitialLoad();
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Email a password setup link'));
    if (!button) {
      throw new Error('Password setup button was not rendered.');
    }
    button.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Email failed.');
  }, 10_000);

  it('enables TOTP only after verification and shows recovery codes once enabled', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const password = fixture.nativeElement.querySelector(
      '#authenticator-password',
    ) as HTMLInputElement;
    password.value = 'current-password';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelectorAll('form')[2] as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(enableTwoFactor).toHaveBeenCalledWith({ password: 'current-password' });
    expect(fixture.nativeElement.textContent).toContain('TESTSECRET');
    expect(fixture.nativeElement.textContent).not.toContain('BACKUP-ONE');

    const code = fixture.nativeElement.querySelector('#totp-code') as HTMLInputElement;
    code.value = '12345';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const codeForm = code.closest('form');
    if (!codeForm) {
      throw new Error('Authenticator verification form was not rendered.');
    }
    codeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(verifyTotp).not.toHaveBeenCalled();

    code.value = '123456';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    codeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(verifyTotp).toHaveBeenCalledWith({ code: '123456' });
    expect(fixture.nativeElement.textContent).toContain('BACKUP-ONE');

    const authenticatorPassword = fixture.nativeElement.querySelector(
      '#authenticator-password',
    ) as HTMLInputElement;
    authenticatorPassword.value = 'current-password';
    authenticatorPassword.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const regenerateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Regenerate backup codes'));
    if (!regenerateButton) {
      throw new Error('Regenerate backup codes button was not rendered.');
    }
    generateBackupCodes.mockResolvedValueOnce({ data: {}, error: null });
    regenerateButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Unable to generate backup codes.');

    generateBackupCodes.mockResolvedValueOnce({
      data: null,
      error: { message: 'Codes unavailable.' },
    });
    regenerateButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Codes unavailable.');

    regenerateButton.click();
    await fixture.whenStable();
    expect(generateBackupCodes).toHaveBeenCalledWith({ password: 'current-password' });
    expect(fixture.nativeElement.textContent).toContain('NEW-ONE');

    const disableButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Disable two-factor'));
    if (!disableButton) {
      throw new Error('Disable two-factor button was not rendered.');
    }
    disableTwoFactor.mockResolvedValueOnce({ data: null, error: {} });
    disableButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to disable two-factor authentication.',
    );

    disableButton.click();
    await fixture.whenStable();
    expect(disableTwoFactor).toHaveBeenCalledWith({ password: 'current-password' });
  }, 10_000);

  it('starts TOTP setup for a passwordless account and handles QR errors', async () => {
    qrcodeMock.mockImplementationOnce(() => {
      throw new Error('QR generation failed.');
    });
    fixture = createFixture();
    await waitForInitialLoad();
    const startButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Set up authenticator app'));
    if (!startButton) {
      throw new Error('Set up authenticator app button was not rendered.');
    }
    startButton.click();
    await fixture.whenStable();

    expect(enableTwoFactor).toHaveBeenCalledWith({});
    expect(fixture.nativeElement.textContent).toContain('Use the setup key instead.');
    expect(fixture.nativeElement.textContent).toContain('TESTSECRET');
  }, 10_000);

  it('supports passwordless backup-code regeneration and 2FA disable', async () => {
    getSession.mockResolvedValueOnce({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: true, twoFactorEnabled: true },
      },
      error: null,
    });
    fixture = createFixture();
    await waitForInitialLoad();

    const regenerateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Regenerate backup codes'));
    const disableButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Disable two-factor'));
    if (!regenerateButton || !disableButton) {
      throw new Error('Two-factor management buttons were not rendered.');
    }

    regenerateButton.click();
    await fixture.whenStable();
    expect(generateBackupCodes).toHaveBeenCalledWith({});
    disableButton.click();
    await fixture.whenStable();
    expect(disableTwoFactor).toHaveBeenCalledWith({});
  }, 10_000);

  it('handles an authenticator URI without a secret query parameter', async () => {
    enableTwoFactor.mockResolvedValueOnce({
      data: {
        method: 'totp',
        totpURI: 'otpauth://totp/HikingDownward?issuer=HikingDownward',
        backupCodes: [],
      },
      error: null,
    });
    fixture = createFixture();
    await waitForInitialLoad();
    const startButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Set up authenticator app'));
    if (!startButton) {
      throw new Error('Set up authenticator app button was not rendered.');
    }
    startButton.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('code').textContent.trim()).toBe('');
  }, 10_000);

  it('shows the setup fallback when a successful TOTP response has no URI', async () => {
    enableTwoFactor.mockResolvedValueOnce({ data: { method: 'totp' }, error: null });
    fixture = createFixture();
    await waitForInitialLoad();
    const startButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Set up authenticator app'));
    if (!startButton) {
      throw new Error('Set up authenticator app button was not rendered.');
    }
    startButton.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Unable to start authenticator setup.');
  }, 10_000);

  it('regenerates backup codes and disables 2FA without a password', async () => {
    getSession.mockResolvedValueOnce({
      data: {
        session: { token: 'current-session-secret' },
        user: { email: 'hiker@example.com', emailVerified: true, twoFactorEnabled: true },
      },
      error: null,
    });
    fixture = createFixture();
    await waitForInitialLoad();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    const regenerateButton = buttons.find((button) =>
      String(button.textContent).includes('Regenerate backup codes'),
    );
    const disableButton = buttons.find((button) =>
      String(button.textContent).includes('Disable two-factor'),
    );
    if (!regenerateButton || !disableButton) {
      throw new Error('Two-factor management buttons were not rendered.');
    }

    regenerateButton.click();
    await fixture.whenStable();
    expect(generateBackupCodes).toHaveBeenCalledWith({});
    disableButton.click();
    await fixture.whenStable();
    expect(disableTwoFactor).toHaveBeenCalledWith({});
  }, 10_000);

  it('reports an individual session revoke error', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    revokeSession.mockResolvedValueOnce({
      data: null,
      error: { message: 'Session already revoked.' },
    });
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).trim() === 'Sign out');
    if (!button) {
      throw new Error('Other session sign-out button was not rendered.');
    }
    button.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Session already revoked.');
  }, 10_000);

  it('shows TOTP setup and verification API failures', async () => {
    enableTwoFactor.mockResolvedValueOnce({
      data: null,
      error: { message: 'Fresh session required.' },
    });
    fixture = createFixture();
    await waitForInitialLoad();
    const startButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Set up authenticator app'));
    if (!startButton) {
      throw new Error('Set up authenticator app button was not rendered.');
    }
    startButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Fresh session required.');

    enableTwoFactor.mockResolvedValueOnce({
      data: {
        method: 'totp',
        totpURI: 'otpauth://totp/HikingDownward?secret=TESTSECRET&issuer=HikingDownward',
        backupCodes: ['BACKUP-ONE'],
      },
      error: null,
    });
    fixture = createFixture();
    await waitForInitialLoad();
    const secondStartButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Set up authenticator app'));
    if (!secondStartButton) {
      throw new Error('Set up authenticator app button was not rendered.');
    }
    secondStartButton.click();
    await fixture.whenStable();
    verifyTotp.mockResolvedValueOnce({ data: null, error: { message: 'Invalid code.' } });
    const code = fixture.nativeElement.querySelector('#totp-code') as HTMLInputElement;
    code.value = '123456';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const verificationForm = code.closest('form');
    if (!verificationForm) {
      throw new Error('Authenticator verification form was not rendered.');
    }
    verificationForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Invalid code.');
    expect(fixture.nativeElement.textContent).not.toContain('BACKUP-ONE');
  }, 10_000);

  it('shows the fallback when TOTP setup returns malformed success data', async () => {
    enableTwoFactor.mockResolvedValueOnce({ data: { method: 'totp' }, error: null });
    fixture = createFixture();
    await waitForInitialLoad();
    const startButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Set up authenticator app'));
    if (!startButton) {
      throw new Error('Set up authenticator app button was not rendered.');
    }
    startButton.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Unable to start authenticator setup.');
  }, 10_000);

  it('returns an empty manual setup key before TOTP enrollment starts', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const component = fixture.componentInstance as unknown as { manualTotpKey: () => string };

    expect(component.manualTotpKey()).toBeNull();
  }, 10_000);

  it('shows an individual session-revocation error', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    revokeSession.mockResolvedValueOnce({
      data: null,
      error: { message: 'Session was already revoked.' },
    });
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).trim() === 'Sign out');
    if (!button) {
      throw new Error('Other session sign-out button was not rendered.');
    }
    button.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Session was already revoked.');
  }, 10_000);

  it('revokes other sessions', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    const button = buttons.find((candidate) =>
      String(candidate.textContent).includes('Sign out other sessions'),
    );
    if (!button) {
      throw new Error('Sign out other sessions button was not rendered.');
    }
    button.click();
    await fixture.whenStable();

    expect(revokeOtherSessions).toHaveBeenCalledOnce();
  }, 10_000);

  it('renders the unsupported passkey state when WebAuthn is unavailable', async () => {
    fixture = createFixture();
    await waitForInitialLoad();

    expect(fixture.nativeElement.textContent).toContain(
      'Passkeys require a supported browser and a secure connection.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Add passkey');
  }, 10_000);

  it('registers, renames, and removes a passkey with confirmation', async () => {
    passkeyState.data = [
      { id: 'passkey-1', name: 'Laptop', createdAt: new Date('2026-01-01T00:00:00Z') },
    ];
    vi.stubGlobal('PublicKeyCredential', class {});
    vi.stubGlobal('isSecureContext', true);
    fixture = createFixture();
    await waitForInitialLoad();

    const newName = fixture.nativeElement.querySelector('#passkey-name') as HTMLInputElement;
    newName.value = 'Phone';
    newName.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const addButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => String(button.textContent).includes('Add passkey'));
    if (!addButton) {
      throw new Error('Add passkey button was not rendered.');
    }
    addButton.click();
    await fixture.whenStable();
    expect(addPasskey).toHaveBeenCalledWith({ name: 'Phone' });

    const passkeyName = fixture.nativeElement.querySelector(
      '#passkey-name-passkey-1',
    ) as HTMLInputElement;
    passkeyName.value = 'Work laptop';
    const row = passkeyName.closest('li');
    if (!row) {
      throw new Error('Passkey row was not rendered.');
    }
    const saveNameButton = Array.from(row.querySelectorAll('button')).find((button) =>
      String(button.textContent).includes('Save name'),
    );
    if (!saveNameButton) {
      throw new Error('Save name button was not rendered.');
    }
    saveNameButton.click();
    await fixture.whenStable();
    expect(passkeyFetch).toHaveBeenCalledWith(
      '/passkey/update-passkey',
      expect.objectContaining({ body: { id: 'passkey-1', name: 'Work laptop' } }),
    );

    const removeButton = Array.from(row.querySelectorAll('button')).find((button) =>
      String(button.textContent).includes('Remove'),
    );
    if (!removeButton) {
      throw new Error('Remove button was not rendered.');
    }
    removeButton.click();
    fixture.detectChanges();
    const cancelButton = Array.from(row.querySelectorAll('button')).find((button) =>
      String(button.textContent).includes('Cancel'),
    );
    if (!cancelButton) {
      throw new Error('Cancel button was not rendered.');
    }
    cancelButton.click();
    fixture.detectChanges();

    const confirmRemove = Array.from(row.querySelectorAll('button')).find(
      (button) => String(button.textContent).trim() === 'Remove',
    );
    if (!confirmRemove) {
      throw new Error('Confirm remove button was not rendered.');
    }
    confirmRemove.click();
    fixture.detectChanges();
    const confirmButton = Array.from(row.querySelectorAll('button')).find(
      (button) => String(button.textContent).trim() === 'Confirm',
    );
    if (!confirmButton) {
      throw new Error('Confirm button was not rendered.');
    }
    passkeyFetch.mockResolvedValueOnce({ data: null, error: { message: 'Removal failed.' } });
    confirmButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Removal failed.');

    const retryConfirm = Array.from(row.querySelectorAll('button')).find(
      (button) => String(button.textContent).trim() === 'Confirm',
    );
    if (!retryConfirm) {
      throw new Error('Retry confirmation button was not rendered.');
    }
    retryConfirm.click();
    await fixture.whenStable();
    expect(passkeyFetch).toHaveBeenCalledWith(
      '/passkey/delete-passkey',
      expect.objectContaining({ body: { id: 'passkey-1' } }),
    );
  }, 10_000);

  it('shows passkey registration and mutation failures', async () => {
    vi.stubGlobal('PublicKeyCredential', class {});
    vi.stubGlobal('isSecureContext', true);
    fixture = createFixture();
    await waitForInitialLoad();
    addPasskey.mockResolvedValueOnce({ data: null, error: { message: 'Registration failed.' } });
    fixture.detectChanges();
    const addButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => String(button.textContent).includes('Add passkey'));
    if (!addButton) {
      throw new Error('Add passkey button was not rendered.');
    }
    addButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Registration failed.');

    passkeyState.data = [
      { id: 'passkey-1', name: 'Laptop', createdAt: new Date('2026-01-01T00:00:00Z') },
    ];
    fixture = createFixture();
    await waitForInitialLoad();
    passkeyFetch.mockResolvedValueOnce({ data: null, error: { message: 'Rename failed.' } });
    const nameField = fixture.nativeElement.querySelector(
      '#passkey-name-passkey-1',
    ) as HTMLInputElement;
    const row = nameField.closest('li');
    if (!row) {
      throw new Error('Passkey row was not rendered.');
    }
    const saveButton = Array.from(row.querySelectorAll('button')).find((button) =>
      String(button.textContent).includes('Save name'),
    );
    if (!saveButton) {
      throw new Error('Save name button was not rendered.');
    }
    saveButton.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Rename failed.');
  }, 10_000);

  it('revoke current and other sessions with appropriate outcomes', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const sessionButtons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    const otherSessionButton = sessionButtons.find(
      (button) => String(button.textContent).trim() === 'Sign out',
    );
    if (!otherSessionButton) {
      throw new Error('Other session sign-out button was not rendered.');
    }
    otherSessionButton.click();
    await fixture.whenStable();
    expect(revokeSession).toHaveBeenCalledWith({ token: 'other-session-secret' });

    const currentSessionButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => String(button.textContent).includes('Sign out this device'));
    if (!currentSessionButton) {
      throw new Error('Current session sign-out button was not rendered.');
    }
    currentSessionButton.click();
    await fixture.whenStable();
    expect(navigation).toHaveBeenCalledWith('/sign-in');
  }, 10_000);

  it('shows session-revocation errors', async () => {
    fixture = createFixture();
    await waitForInitialLoad();
    revokeOtherSessions.mockResolvedValueOnce({ data: null, error: { message: 'Revoke failed.' } });
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((candidate) => String(candidate.textContent).includes('Sign out other sessions'));
    if (!button) {
      throw new Error('Sign out other sessions button was not rendered.');
    }
    button.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Revoke failed.');
  }, 10_000);
});
