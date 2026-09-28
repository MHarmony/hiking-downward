# `@hiking-downward/sign-in`

Standalone Angular sign-in component for HikingDownward frontend applications.

## Usage

Lazy-load `SignIn` from the application router:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'sign-in',
    loadComponent: async () => import('@hiking-downward/sign-in').then((m) => m.SignIn),
    title: 'HikingDownward - Sign In',
  },
];
```

The component obtains its Better Auth client from
`@hiking-downward/frontend-auth` and supports:

- Password sign-in with an email address or username.
- Email-only magic-link sign-in.
- Explicit passkey sign-in and conditional passkey autofill when supported by
  the browser.
- Better Auth two-factor redirects to `/two-factor`, provided by
  `@hiking-downward/two-factor`.

Successful password and passkey authentication navigates to `/`. The component
also links to `/forgot-password`, provided by `@hiking-downward/password-reset`,
and `/sign-up`, so applications should provide those routes.

Network failures and server errors are reported to Sentry. Expected credential
errors remain user-facing and are not reported.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/sign-in
bun nx lint @hiking-downward/sign-in
bun nx typecheck @hiking-downward/sign-in
bun nx typecheck:test @hiking-downward/sign-in
bun nx test @hiking-downward/sign-in
```
