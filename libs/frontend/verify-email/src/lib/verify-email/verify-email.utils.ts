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
 * Explains a Better Auth email verification error code to the user.
 *
 * @param code The `error` query parameter Better Auth appends when verification fails.
 * @returns A user-facing explanation of the failure.
 */
export function verificationErrorMessage(code: string): string {
  switch (code) {
    case 'TOKEN_EXPIRED':
      return 'This verification link has expired.';
    case 'INVALID_TOKEN':
      return 'This verification link is invalid.';
    case 'USER_NOT_FOUND':
      return "We couldn't find an account for this verification link.";
    default:
      return "We couldn't verify your email address.";
  }
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
