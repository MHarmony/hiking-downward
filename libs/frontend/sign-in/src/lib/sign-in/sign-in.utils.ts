/** Authentication flow that can be initiated from the sign-in form. */
export type SignInMethod = 'password' | 'magicLink';

/** Auth client method selected for an identifier. */
export type IdentifierMethod = 'email' | 'username';

/**
 * Removes surrounding whitespace before an identifier is sent to the auth API.
 *
 * @param identifier The raw identifier entered by the user.
 * @returns The identifier without leading or trailing whitespace.
 */
export function normalizeIdentifier(identifier: string): string {
  return identifier.trim();
}

/**
 * Selects email sign-in for identifiers containing `@`, otherwise username sign-in.
 *
 * @param identifier The raw or normalized identifier to classify.
 * @returns The auth client method appropriate for the identifier.
 */
export function identifierMethod(identifier: string): IdentifierMethod {
  return normalizeIdentifier(identifier).includes('@') ? 'email' : 'username';
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
