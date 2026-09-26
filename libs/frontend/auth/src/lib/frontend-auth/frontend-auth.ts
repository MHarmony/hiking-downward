import { inject, InjectionToken, Service } from '@angular/core';
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';
import {
  adminClient,
  magicLinkClient,
  twoFactorClient,
  usernameClient,
} from 'better-auth/client/plugins';

/** Base URL used by the browser-side Better Auth client. */
export const AUTH_BASE_URL = new InjectionToken<string>('AUTH_BASE_URL', {
  factory: (): string => 'http://localhost:3000',
});

/** Provides the configured Better Auth client to frontend features. */
@Service()
export class FrontendAuth {
  /** Better Auth client configured with the application's enabled auth plugins. */
  public authClient = createAuthClient({
    baseURL: inject(AUTH_BASE_URL),
    plugins: [
      adminClient(),
      magicLinkClient(),
      twoFactorClient({ twoFactorPage: '/two-factor' }),
      usernameClient({ displayUsername: true }),
      passkeyClient(),
    ],
  });
}
