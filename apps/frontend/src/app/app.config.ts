import {
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { createErrorHandler, getClient, setUser, TraceService } from '@sentry/angular';

import { appRoutes } from './app.routes';

/** Angular application configuration for the HikingDownward frontend. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    { provide: ErrorHandler, useFactory: () => createErrorHandler({ logErrors: true }) },
    // Eagerly instantiated so it can record router navigation spans.
    provideAppInitializer(() => {
      inject(TraceService);
    }),
    // Keeps the Sentry user in step with sign-in, sign-out, and restored sessions.
    provideAppInitializer(() => {
      if (!getClient()) {
        return;
      }
      inject(FrontendAuth).authClient.useSession.subscribe(({ data }) => {
        setUser(data ? { id: data.user.id } : null);
      });
    }),
  ],
};
