import { inject } from '@angular/core';
import { RedirectCommand, Router, type CanActivateFn } from '@angular/router';
import { FrontendAuth } from './frontend-auth';

/**
 * Renders the not-found page while keeping the requested URL in the address bar.
 *
 * @param router Router used to build the not-found URL.
 * @returns A redirect command targeting the wildcard not-found route.
 */
function notFound(router: Router): RedirectCommand {
  return new RedirectCommand(router.parseUrl('/404'), { skipLocationChange: true });
}

/**
 * Allows the two-factor page only while a sign-in attempt awaits a second factor.
 *
 * @returns `true` when a challenge is pending, otherwise a redirect to the not-found page.
 */
export const pendingTwoFactorGuard: CanActivateFn = () =>
  inject(FrontendAuth).hasPendingTwoFactor() || notFound(inject(Router));

/**
 * Allows the verification result page only for a registered verification callback.
 *
 * @param route The route being activated.
 * @returns `true` for a verification outcome, otherwise a redirect to the not-found page.
 */
export const emailVerificationResultGuard: CanActivateFn = (route) =>
  inject(FrontendAuth).hasPendingEmailVerification(route.queryParamMap.get('flow')) ||
  notFound(inject(Router));

/**
 * Allows the sign-up completion page only for a registered magic-link callback.
 *
 * @param route The route being activated.
 * @returns `true` for a magic-link sign-up callback, otherwise a redirect to the not-found page.
 */
export const signUpCompletionGuard: CanActivateFn = (route) =>
  inject(FrontendAuth).hasPendingSignUpCompletion(route.queryParamMap.get('flow')) ||
  notFound(inject(Router));
