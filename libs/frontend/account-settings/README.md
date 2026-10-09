# Account Settings

Angular account-management pages for the Hiking Downward frontend. The library
provides profile editing, security controls, account deletion, and the public
account-deleted confirmation page.

## Routes

- `/settings/profile` updates the display name and public username, which can also be used to sign in.
- `/settings/security` manages email, password, two-factor authentication,
  passkeys, and active sessions.
- `/settings/account` requests email-confirmed account deletion.
- `/account-deleted` confirms the completed deletion.

The `/settings` route is protected by the frontend authentication guard.

## Validation

Run targets from the workspace root:

```sh
bun nx run @hiking-downward/account-settings:test
bun nx run @hiking-downward/account-settings:lint
bun nx run @hiking-downward/account-settings:typecheck
bun nx run @hiking-downward/account-settings:typecheck:test
```
