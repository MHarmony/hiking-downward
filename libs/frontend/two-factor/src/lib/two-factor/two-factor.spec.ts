import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { captureException } from '@sentry/angular';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from '@hiking-downward/frontend-auth';

import { TwoFactor } from './two-factor';
import { codeError, isTotpCode, normalizeCode, shouldReportAuthFailure } from './two-factor.utils';

vi.mock('@sentry/angular', () => ({
  captureException: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

/**
 * Mock signature shared by the Better Auth two-factor verification methods.
 *
 * @param options Request values accepted by the mocked method.
 * @returns A promise containing mocked auth data or an auth error.
 */
type AuthMethod = (options?: Record<string, unknown>) => Promise<{
  data: Record<string, unknown> | null;
  error: { status: number; message?: string } | null;
}>;

/** Better Auth client surface exercised by the two-factor component tests. */
type AuthClientMock = {
  /** Two-factor verification methods. */
  twoFactor: {
    verifyTotp: ReturnType<typeof vi.fn<AuthMethod>>;
    verifyBackupCode: ReturnType<typeof vi.fn<AuthMethod>>;
  };
};

/** Whitespace characters users commonly type or paste between code groups. */
const whitespace = fc.constantFrom(' ', '\t', '\n', '\u00a0');

/** Six-digit authenticator codes. */
const totpCode = fc
  .array(fc.constantFrom(...'0123456789'.split('')), { minLength: 6, maxLength: 6 })
  .map((digits) => digits.join(''));

describe('TwoFactor', () => {
  let authClient: AuthClientMock;

  beforeEach(() => {
    vi.clearAllMocks();
    authClient = {
      twoFactor: {
        verifyTotp: vi.fn<AuthMethod>().mockResolvedValue({ data: {}, error: null }),
        verifyBackupCode: vi.fn<AuthMethod>().mockResolvedValue({ data: {}, error: null }),
      },
    };
    TestBed.configureTestingModule({
      imports: [TwoFactor],
      providers: [provideRouter([]), { provide: FrontendAuth, useValue: { authClient } }],
    });
  });

  /**
   * Creates a rendered two-factor component fixture.
   *
   * @returns The initialized component fixture.
   */
  function createFixture(): ComponentFixture<TwoFactor> {
    const fixture = TestBed.createComponent(TwoFactor);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Enters a code through the input's DOM binding.
   *
   * @param fixture The component fixture containing the input.
   * @param value The code to enter.
   */
  function setCode(fixture: ComponentFixture<TwoFactor>, value: string): void {
    const input = fixture.nativeElement.querySelector('#code') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Submits the verification form and waits for Angular to stabilize.
   *
   * @param fixture The component fixture containing the form.
   * @returns A promise that settles when form processing is stable.
   */
  async function submitForm(fixture: ComponentFixture<TwoFactor>): Promise<void> {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  /**
   * Clicks the button that switches between verification methods.
   *
   * @param fixture The component fixture containing the button.
   * @returns A promise that settles when Angular is stable.
   */
  async function toggleMethod(fixture: ComponentFixture<TwoFactor>): Promise<void> {
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
  }

  it('removes all whitespace from codes idempotently', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeCode(value);
        expect(normalized).not.toMatch(/\s/u);
        expect(normalizeCode(normalized)).toBe(normalized);
      }),
    );
  }, 10_000);

  it('accepts authenticator codes regardless of interleaved whitespace', () => {
    fc.assert(
      fc.property(totpCode, fc.array(whitespace, { maxLength: 4 }), (code, spaces) => {
        const spaced = `${spaces.join('')}${code.slice(0, 3)}${spaces.join('')}${code.slice(3)}`;
        expect(normalizeCode(spaced)).toBe(code);
        expect(isTotpCode(normalizeCode(spaced))).toBe(true);
        expect(codeError('totp', spaced)).toBeNull();
      }),
    );
  }, 10_000);

  it('accepts a TOTP code only when it normalizes to exactly six digits', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const valid = /^[0-9]{6}$/u.test(normalizeCode(value));
        expect(codeError('totp', value) === null).toBe(valid);
      }),
    );
  }, 10_000);

  it('accepts a backup code only when it contains non-whitespace characters', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(codeError('backupCode', value) === null).toBe(normalizeCode(value) !== '');
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

  it('submits generated spaced authenticator codes in normalized form', async () => {
    await fc.assert(
      fc.asyncProperty(totpCode, async (code) => {
        authClient.twoFactor.verifyTotp.mockClear();
        const fixture = createFixture();
        try {
          setCode(fixture, ` ${code.slice(0, 3)} ${code.slice(3)} `);
          await submitForm(fixture);

          expect(authClient.twoFactor.verifyTotp).toHaveBeenLastCalledWith({
            code,
            trustDevice: false,
          });
        } finally {
          fixture.destroy();
        }
      }),
      { numRuns: 25 },
    );
  }, 30_000);

  it('renders authenticator code verification by default', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Two-factor authentication');
    expect(text).toContain('Enter the 6-digit code from your authenticator app.');
    expect(text).toContain('Authentication code');
    expect(text).toContain('Trust this device for 30 days');
    expect(text).toContain('Use a backup code instead');
    const input = fixture.nativeElement.querySelector('#code') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  }, 10_000);

  it('requires a code and focuses the field before verification', async () => {
    const fixture = createFixture();
    await submitForm(fixture);

    const input = fixture.nativeElement.querySelector('#code') as HTMLInputElement;
    expect(fixture.nativeElement.textContent).toContain(
      'Enter the 6-digit code from your authenticator app.',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('code-error');
    expect(fixture.nativeElement.ownerDocument.activeElement).toBe(input);
    expect(authClient.twoFactor.verifyTotp).not.toHaveBeenCalled();
  }, 10_000);

  it('rejects a malformed authenticator code', async () => {
    const fixture = createFixture();
    setCode(fixture, '12345');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Authenticator codes are 6 digits.');
    expect(authClient.twoFactor.verifyTotp).not.toHaveBeenCalled();
  }, 10_000);

  it('verifies an authenticator code, trusts the device, and navigates home', async () => {
    const fixture = createFixture();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    setCode(fixture, '123456');
    const trustDevice = fixture.nativeElement.querySelector('#trustDevice') as HTMLInputElement;
    trustDevice.click();
    await submitForm(fixture);

    expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: '123456',
      trustDevice: true,
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  }, 10_000);

  it('switches to backup code verification and back', async () => {
    const fixture = createFixture();
    setCode(fixture, '12');
    await submitForm(fixture);
    await toggleMethod(fixture);

    const input = fixture.nativeElement.querySelector('#code') as HTMLInputElement;
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Backup code');
    expect(text).toContain('Enter one of the backup codes you saved');
    expect(text).toContain('Use your authenticator app instead');
    expect(text).not.toContain('Authenticator codes are 6 digits.');
    expect(input.value).toBe('');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('inputmode')).toBe('text');

    await submitForm(fixture);
    expect(fixture.nativeElement.textContent).toContain('Enter one of your backup codes.');
    expect(authClient.twoFactor.verifyBackupCode).not.toHaveBeenCalled();

    await toggleMethod(fixture);
    expect(fixture.nativeElement.textContent).toContain('Authentication code');
  }, 10_000);

  it('verifies a backup code', async () => {
    const fixture = createFixture();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await toggleMethod(fixture);
    setCode(fixture, ' abcde-12345 ');
    await submitForm(fixture);

    expect(authClient.twoFactor.verifyBackupCode).toHaveBeenCalledWith({
      code: 'abcde-12345',
      trustDevice: false,
    });
    expect(authClient.twoFactor.verifyTotp).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  }, 10_000);

  it('shows an expected verification error without reporting it', async () => {
    authClient.twoFactor.verifyTotp.mockResolvedValue({
      data: null,
      error: { status: 401, message: 'Invalid code' },
    });
    const fixture = createFixture();
    setCode(fixture, '123456');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Invalid code');
    expect(captureException).not.toHaveBeenCalled();
  }, 10_000);

  it('reports operational verification failures', async () => {
    authClient.twoFactor.verifyBackupCode.mockResolvedValue({
      data: null,
      error: { status: 500 },
    });
    const fixture = createFixture();
    await toggleMethod(fixture);
    setCode(fixture, 'abcde-12345');
    await submitForm(fixture);

    expect(fixture.nativeElement.textContent).toContain('Unable to verify your code.');
    expect(captureException).toHaveBeenCalledOnce();

    authClient.twoFactor.verifyBackupCode.mockResolvedValue({
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
