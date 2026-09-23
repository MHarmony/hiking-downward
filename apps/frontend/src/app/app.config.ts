import {
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { createErrorHandler } from '@sentry/angular';

import { appRoutes } from './app.routes';

/** Angular application configuration for the HikingDownward frontend. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    { provide: ErrorHandler, useFactory: () => createErrorHandler({ logErrors: true }) },
  ],
};
