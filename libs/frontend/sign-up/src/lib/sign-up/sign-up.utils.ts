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
 * @param password The original password value.
 * @param confirmation The repeated password value to compare.
 * @returns `true` when both password values are identical.
 */
export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}

/**
 * Returns whether an auth failure is operational rather than user input.
 *
 * @param status The HTTP-like status returned by the auth client; `0` represents a network failure.
 * @returns `true` when the failure should be reported to Sentry.
 */
export function shouldReportAuthFailure(status: number): boolean {
  return status === 0 || status >= 500;
}
