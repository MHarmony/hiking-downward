# `@hiking-downward/sign-up`

Standalone Angular registration components for HikingDownward frontend
applications.

## Usage

Lazy-load `SignUp` and its magic-link completion page from the application
router:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'sign-up',
    loadComponent: async () => import('@hiking-downward/sign-up').then((m) => m.SignUp),
    title: 'HikingDownward - Sign Up',
  },
  {
    path: 'sign-up/complete',
    loadComponent: async () => import('@hiking-downward/sign-up').then((m) => m.SignUpComplete),
    title: 'HikingDownward - Sign Up Complete',
  },
];
```

`SignUp` obtains its Better Auth client from
`@hiking-downward/frontend-auth` and supports email/password and magic-link
registration. Email addresses are trimmed and lowercased before submission.
Passwords must contain between 8 and 128 characters and match the confirmation
field.

Magic-link registration uses `/sign-up/complete` as its new-user callback.
`SignUpComplete` confirms that the link was processed and links to `/`. Password
registration sends verification links that return to `/verify-email/result`,
provided by `@hiking-downward/verify-email`. The registration form also links to
`/sign-in`.

Network failures and server errors are reported to Sentry. Expected validation
and registration errors remain user-facing and are not reported.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/sign-up
bun nx lint @hiking-downward/sign-up
bun nx typecheck @hiking-downward/sign-up
bun nx typecheck:test @hiking-downward/sign-up
bun nx test @hiking-downward/sign-up
```
