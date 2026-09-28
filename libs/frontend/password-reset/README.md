# `@hiking-downward/password-reset`

Standalone Angular password reset pages for HikingDownward frontend
applications.

## Usage

Lazy-load `ForgotPassword` and `ResetPassword` from the application router:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'forgot-password',
    loadComponent: async () =>
      import('@hiking-downward/password-reset').then((m) => m.ForgotPassword),
    title: 'HikingDownward - Forgot Password',
  },
  {
    path: 'reset-password',
    loadComponent: async () =>
      import('@hiking-downward/password-reset').then((m) => m.ResetPassword),
    title: 'HikingDownward - Reset Password',
  },
];
```

`ForgotPassword` requests a reset email for a trimmed, lowercased address. Its
confirmation does not reveal whether an account exists. Reset emails return to
`/reset-password`.

`ResetPassword` reads the `token` and `error` query parameters Better Auth adds
to that redirect. Invalid or expired links link to `/forgot-password`. Usable
links accept a new password of 8 to 128 characters that matches its
confirmation, then link to `/sign-in`. The API revokes existing sessions after a
reset.

Network failures and server errors are reported to Sentry. Expected request and
reset errors remain user-facing and are not reported.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/password-reset
bun nx lint @hiking-downward/password-reset
bun nx typecheck @hiking-downward/password-reset
bun nx typecheck:test @hiking-downward/password-reset
bun nx test @hiking-downward/password-reset
```
