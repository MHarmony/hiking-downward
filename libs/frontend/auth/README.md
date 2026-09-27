# `@hiking-downward/frontend-auth`

Configured browser-side Better Auth client for HikingDownward Angular
applications.

## Configuration

`AUTH_BASE_URL` controls the auth server origin and defaults to
`http://localhost:3000`. Production applications should override it with their
runtime API URL during bootstrap:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AUTH_BASE_URL } from '@hiking-downward/frontend-auth';

const runtimeConfig = await loadRuntimeConfig();

await bootstrapApplication(App, {
  providers: [{ provide: AUTH_BASE_URL, useValue: runtimeConfig.apiUrl }],
});
```

## Usage

Inject `FrontendAuth` and use its configured client:

```ts
import { Component, inject } from '@angular/core';
import { FrontendAuth } from '@hiking-downward/frontend-auth';

@Component({ template: '' })
export class Account {
  readonly #authClient = inject(FrontendAuth).authClient;

  protected async signOut(): Promise<void> {
    await this.#authClient.signOut();
  }
}
```

The client includes Better Auth's admin, magic-link, two-factor, username, and
passkey plugins. Two-factor authentication uses `/two-factor` as its redirect
page, and username support includes display usernames.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/frontend-auth
bun nx lint @hiking-downward/frontend-auth
bun nx typecheck @hiking-downward/frontend-auth
bun nx typecheck:test @hiking-downward/frontend-auth
bun nx test @hiking-downward/frontend-auth
```
