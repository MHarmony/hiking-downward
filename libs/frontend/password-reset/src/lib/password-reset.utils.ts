/** Better Auth's default password policy, made explicit by the API configuration. */
export const MIN_PASSWORD_LENGTH = 8;
/** Maximum password length accepted by Better Auth. */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Removes surrounding whitespace and normalizes an email for account identity.
 *
 * @param email The raw email address entered by the user.
 * @returns The trimmed, lowercase email address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns whether a password confirmation matches the password.
 *
 * @param password The new password value.
 * @param confirmation The repeated password value to compare.
 * @returns `true` when both password values are identical.
 */
export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}

/**
 * Extracts a usable reset token from the query parameters Better Auth redirects with.
 *
 * @param token The `token` query parameter, when present.
 * @param error The `error` query parameter Better Auth sets for invalid or expired links.
 * @returns The token when the link can be used, otherwise an empty string.
 */
export function resetToken(token: string | null, error: string | null): string {
  return error === null && token !== null ? token : '';
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
