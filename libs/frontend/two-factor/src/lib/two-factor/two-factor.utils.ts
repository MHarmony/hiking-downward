/// <reference types="@angular/localize" />

/** Verification method used to complete a pending two-factor sign-in. */
export type TwoFactorMethod = 'totp' | 'backupCode';

/**
 * Removes whitespace that users commonly type or paste between code groups.
 *
 * @param code The raw code entered by the user.
 * @returns The code without any whitespace characters.
 */
export function normalizeCode(code: string): string {
  return code.replaceAll(/\s/gu, '');
}

/**
 * Returns whether a normalized code has the shape of an authenticator app code.
 *
 * @param code The normalized code to check.
 * @returns `true` when the code is exactly six ASCII digits.
 */
export function isTotpCode(code: string): boolean {
  return /^[0-9]{6}$/u.test(code);
}

/**
 * Describes why a code cannot be submitted for the selected verification method.
 *
 * @param method The verification method the code is intended for.
 * @param rawCode The raw code entered by the user.
 * @returns A user-facing validation message, or `null` when the code can be submitted.
 */
export function codeError(method: TwoFactorMethod, rawCode: string): string | null {
  const code = normalizeCode(rawCode);
  if (method === 'backupCode') {
    return code === '' ? $localize`Enter one of your backup codes.` : null;
  }
  if (code === '') {
    return $localize`Enter the 6-digit code from your authenticator app.`;
  }
  return isTotpCode(code) ? null : $localize`Authenticator codes are 6 digits.`;
}

/**
 * Returns whether an auth failure represents a network or server-side problem.
 *
 * @param status The HTTP-like status returned by the auth client; `0` represents a network failure.
 * @returns `true` when the failure should be reported to Sentry.
 */
export function shouldReportAuthFailure(status: number): boolean {
  return status === 0 || status >= 500;
}
