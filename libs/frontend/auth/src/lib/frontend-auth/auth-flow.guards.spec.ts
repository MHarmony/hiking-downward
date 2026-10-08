import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  convertToParamMap,
  provideRouter,
  RedirectCommand,
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticatedGuard,
  emailVerificationResultGuard,
  pendingTwoFactorGuard,
  signUpCompletionGuard,
} from './auth-flow.guards';
import { FrontendAuth } from './frontend-auth';

describe('auth flow guards', () => {
  let hasPendingTwoFactor: ReturnType<typeof vi.fn<() => boolean>>;
  let hasPendingEmailVerification: ReturnType<typeof vi.fn<(flowId: string | null) => boolean>>;
  let hasPendingSignUpCompletion: ReturnType<typeof vi.fn<(flowId: string | null) => boolean>>;
  let getSession: ReturnType<typeof vi.fn<() => Promise<{ data: unknown; error: unknown }>>>;

  beforeEach(() => {
    hasPendingTwoFactor = vi.fn<() => boolean>().mockReturnValue(false);
    hasPendingEmailVerification = vi
      .fn<(flowId: string | null) => boolean>()
      .mockReturnValue(false);
    hasPendingSignUpCompletion = vi.fn<(flowId: string | null) => boolean>().mockReturnValue(false);
    getSession = vi.fn<() => Promise<{ data: unknown; error: unknown }>>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: FrontendAuth,
          useValue: {
            hasPendingEmailVerification,
            hasPendingSignUpCompletion,
            hasPendingTwoFactor,
            authClient: { getSession },
          },
        },
      ],
    });
  });

  /**
   * Runs a guard for a route with the given query parameters.
   *
   * @param guard The guard to run.
   * @param queryParams Query parameters on the activated route.
   * @param url Router-state URL supplied to the guard.
   * @returns The guard result.
   */
  async function run(
    guard: typeof pendingTwoFactorGuard,
    queryParams: Record<string, string> = {},
    url = '/some-route',
  ): Promise<unknown> {
    const route = { queryParamMap: convertToParamMap(queryParams) } as ActivatedRouteSnapshot;
    return runInInjectionContext(TestBed.inject(EnvironmentInjector), async () =>
      guard(route, { url } as RouterStateSnapshot),
    );
  }

  /**
   * Asserts that a guard result renders the not-found page in place.
   *
   * @param result The guard result.
   * @returns Nothing; assertion failures are reported by Vitest.
   */
  function expectNotFound(result: unknown): void {
    expect(result).toBeInstanceOf(RedirectCommand);
    const command = result as RedirectCommand;
    expect(command.redirectTo.toString()).toBe('/404');
    expect(command.navigationBehaviorOptions).toEqual({ skipLocationChange: true });
  }

  it('allows the two-factor page while a challenge is pending', async () => {
    expect.hasAssertions();
    hasPendingTwoFactor.mockReturnValue(true);

    await expect(run(pendingTwoFactorGuard)).resolves.toBe(true);
  }, 10_000);

  it('allows an authenticated session into settings', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });

    await expect(run(authenticatedGuard, {}, '/settings/profile')).resolves.toBe(true);
  }, 10_000);

  it('redirects signed-out users to sign-in with the requested route', async () => {
    getSession.mockResolvedValue({ data: null, error: null });

    const result = await run(authenticatedGuard, {}, '/settings/security?tab=sessions');
    expect(result).toBeInstanceOf(RedirectCommand);
    expect(TestBed.inject(Router).serializeUrl((result as RedirectCommand).redirectTo)).toBe(
      '/sign-in?returnUrl=%2Fsettings%2Fsecurity%3Ftab%3Dsessions',
    );
  }, 10_000);

  it('redirects to sign-in when the session endpoint fails', async () => {
    getSession.mockRejectedValue(new Error('Network unavailable'));

    const result = await run(authenticatedGuard, {}, '/settings/account');
    expect(result).toBeInstanceOf(RedirectCommand);
    expect(TestBed.inject(Router).serializeUrl((result as RedirectCommand).redirectTo)).toBe(
      '/sign-in?returnUrl=%2Fsettings%2Faccount',
    );
  }, 10_000);

  it('shows not-found for the two-factor page without a pending challenge', async () => {
    expect.hasAssertions();
    expectNotFound(await run(pendingTwoFactorGuard));
  }, 10_000);

  it('allows the verification result page for a registered callback', async () => {
    expect.hasAssertions();
    hasPendingEmailVerification.mockReturnValue(true);

    await expect(run(emailVerificationResultGuard, { error: 'TOKEN_EXPIRED' })).resolves.toBe(true);
    expect(hasPendingEmailVerification).toHaveBeenCalledWith(null);
  }, 10_000);

  it('shows not-found for the verification result page without a registered callback', async () => {
    expect.hasAssertions();
    expectNotFound(await run(emailVerificationResultGuard));
  }, 10_000);

  it('allows the sign-up completion page for a registered magic-link callback', async () => {
    expect.hasAssertions();
    hasPendingSignUpCompletion.mockReturnValue(true);

    await expect(run(signUpCompletionGuard, { flow: 'test-flow' })).resolves.toBe(true);
    expect(hasPendingSignUpCompletion).toHaveBeenCalledWith('test-flow');
  }, 10_000);

  it('shows not-found for the sign-up completion page without a registered callback', async () => {
    expect.hasAssertions();
    expectNotFound(await run(signUpCompletionGuard));
  }, 10_000);
});
