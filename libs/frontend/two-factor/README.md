# `@hiking-downward/two-factor`

Standalone Angular two-factor verification page for HikingDownward frontend
applications.

## Usage

Lazy-load `TwoFactor` at the route configured as `twoFactorPage` in
`@hiking-downward/frontend-auth`:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'two-factor',
    loadComponent: async () => import('@hiking-downward/two-factor').then((m) => m.TwoFactor),
    title: 'HikingDownward - Two-Factor Authentication',
  },
];
```

Better Auth redirects here when a sign-in requires a second factor. The page
verifies a 6-digit authenticator app code by default and can switch to a
single-use backup code. Whitespace is removed from codes before submission, and
users can choose to trust the device for 30 days.

Successful verification navigates to `/`. The page also links back to
`/sign-in`.

Network failures and server errors are reported to Sentry. Expected
verification errors remain user-facing and are not reported.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/two-factor
bun nx lint @hiking-downward/two-factor
bun nx typecheck @hiking-downward/two-factor
bun nx typecheck:test @hiking-downward/two-factor
bun nx test @hiking-downward/two-factor
```
