/**
 * Resolves Better Auth failures to a usable message without exposing empty responses.
 *
 * @param error Error returned by Better Auth, if the request failed.
 * @param fallback Message to use when no non-empty server message is available.
 * @returns The server message when non-empty, otherwise the supplied fallback.
 */
export function authErrorMessage(error: { message?: string } | null, fallback: string): string {
  if (!error) {
    return fallback;
  }
  const message = error.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
}
