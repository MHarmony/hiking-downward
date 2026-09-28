import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from './frontend-auth';

let responseBody: Record<string, unknown> = {};

/**
 * Sets the JSON body returned by the shared auth fetch stub.
 *
 * @param body The JSON body returned for every request.
 */
function respondWith(body: Record<string, unknown>): void {
  responseBody = body;
}

/** Installs the fetch stub before Better Auth creates its client. */
function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(responseBody), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
    ),
  );
}

describe('FrontendAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', sessionStorage);
    localStorage.clear();
    sessionStorage.clear();
    responseBody = {};
    stubFetch();
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_BASE_URL, useValue: 'https://auth.example.test' }],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates the configured Better Auth client', () => {
    const service = TestBed.inject(FrontendAuth);

    expect(service).toBeInstanceOf(FrontendAuth);
    expect(service.authClient).toBeDefined();
  }, 10_000);

  it('provides the local default base URL when no override is configured', () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(AUTH_BASE_URL)).toBe('http://localhost:3000');
  }, 10_000);

  it('has no pending two-factor challenge by default', () => {
    expect(TestBed.inject(FrontendAuth).hasPendingTwoFactor()).toBe(false);
  }, 10_000);

  it('records a pending challenge and navigates when sign-in requires two-factor', async () => {
    const service = TestBed.inject(FrontendAuth);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    respondWith({ twoFactorRedirect: true });

    await service.authClient.signIn.email({ email: 'hiker@example.com', password: 'password' });

    expect(service.hasPendingTwoFactor()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/two-factor');
  }, 10_000);

  it('expires a pending challenge after ten minutes', async () => {
    const service = TestBed.inject(FrontendAuth);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    respondWith({ twoFactorRedirect: true });
    await service.authClient.signIn.email({ email: 'hiker@example.com', password: 'password' });

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000 + 1);

    expect(service.hasPendingTwoFactor()).toBe(false);
    vi.restoreAllMocks();
  }, 10_000);

  it('clears a pending challenge once a second factor is verified', async () => {
    const service = TestBed.inject(FrontendAuth);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    respondWith({ twoFactorRedirect: true });
    await service.authClient.signIn.email({ email: 'hiker@example.com', password: 'password' });

    respondWith({ token: 'session-token', user: { id: 'hiker' } });
    await service.authClient.twoFactor.verifyTotp({ code: '123456' });

    expect(service.hasPendingTwoFactor()).toBe(false);
  }, 10_000);

  it('registers an email verification callback flow', () => {
    const service = TestBed.inject(FrontendAuth);
    const callbackUrl = service.emailVerificationCallbackUrl('https://app.example.test');
    const flowId = new URL(callbackUrl).searchParams.get('flow');

    expect(callbackUrl).toMatch(/^https:\/\/app\.example\.test\/verify-email\/result\?flow=/);
    expect(service.hasPendingEmailVerification(flowId)).toBe(true);
    expect(service.hasPendingEmailVerification('different-flow')).toBe(false);
  }, 10_000);

  it('rejects and removes an expired verification callback flow', () => {
    const service = TestBed.inject(FrontendAuth);
    const callbackUrl = service.emailVerificationCallbackUrl('https://app.example.test');
    const flowId = new URL(callbackUrl).searchParams.get('flow');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1);

    expect(service.hasPendingEmailVerification(flowId)).toBe(false);
    expect(service.hasPendingEmailVerification(flowId)).toBe(false);
    vi.restoreAllMocks();
  }, 10_000);

  it('removes malformed verification callback state', () => {
    localStorage.setItem('hiking-downward.email-verification-flow', 'not-json');

    expect(TestBed.inject(FrontendAuth).hasPendingEmailVerification('test-flow')).toBe(false);
    expect(localStorage.getItem('hiking-downward.email-verification-flow')).toBeNull();
  }, 10_000);

  it('registers a sign-up completion callback flow', () => {
    const service = TestBed.inject(FrontendAuth);
    const callbackUrl = service.signUpCompletionCallbackUrl('https://app.example.test');
    const flowId = new URL(callbackUrl).searchParams.get('flow');

    expect(callbackUrl).toMatch(/^https:\/\/app\.example\.test\/sign-up\/complete\?flow=/);
    expect(service.hasPendingSignUpCompletion(flowId)).toBe(true);
    expect(service.hasPendingSignUpCompletion('different-flow')).toBe(false);
  }, 10_000);

  it('rejects and removes an expired sign-up completion callback flow', () => {
    const service = TestBed.inject(FrontendAuth);
    const callbackUrl = service.signUpCompletionCallbackUrl('https://app.example.test');
    const flowId = new URL(callbackUrl).searchParams.get('flow');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1);

    expect(service.hasPendingSignUpCompletion(flowId)).toBe(false);
    expect(service.hasPendingSignUpCompletion(flowId)).toBe(false);
    vi.restoreAllMocks();
  }, 10_000);

  it('removes malformed sign-up completion callback state', () => {
    localStorage.setItem('hiking-downward.sign-up-completion-flow', 'not-json');

    expect(TestBed.inject(FrontendAuth).hasPendingSignUpCompletion('test-flow')).toBe(false);
    expect(localStorage.getItem('hiking-downward.sign-up-completion-flow')).toBeNull();
  }, 10_000);
});
