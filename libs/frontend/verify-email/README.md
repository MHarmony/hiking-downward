# `@hiking-downward/verify-email`

Standalone Angular email verification result page for HikingDownward frontend
applications.

## Usage

Lazy-load `VerifyEmailResult` at the callback URL used for verification emails:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'verify-email/result',
    loadComponent: async () =>
      import('@hiking-downward/verify-email').then((m) => m.VerifyEmailResult),
    title: 'HikingDownward - Verify Email',
  },
];
```

Better Auth redirects here after processing a verification link. Without an
`error` query parameter the page confirms verification and links to `/`.

When Better Auth reports `TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, or
another error, the page explains the failure and offers to send a new
verification link to a trimmed, lowercased address. New links return to this
page. The failure state also links to `/sign-in`.

Network failures and server errors are reported to Sentry. Expected resend
errors remain user-facing and are not reported.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/verify-email
bun nx lint @hiking-downward/verify-email
bun nx typecheck @hiking-downward/verify-email
bun nx typecheck:test @hiking-downward/verify-email
bun nx test @hiking-downward/verify-email
```
