/** Bootstraps the HikingDownward Angular application. */
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AUTH_BASE_URL } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { loadRuntimeConfig } from './runtime-config';

const runtimeConfig = await loadRuntimeConfig();

if (runtimeConfig.sentryDsn) {
  Sentry.init({
    dsn: runtimeConfig.sentryDsn,
    environment: runtimeConfig.sentryEnvironment,
    release: runtimeConfig.sentryRelease,
    dataCollection: {
      userInfo: false,
    },
  });
}

/** Runtime providers that override the local auth endpoint when configured. */
const runtimeProviders = runtimeConfig.apiUrl
  ? [{ provide: AUTH_BASE_URL, useValue: runtimeConfig.apiUrl }]
  : [];

/** Starts Angular with the loaded runtime configuration and reports bootstrap failures. */
bootstrapApplication(App, mergeApplicationConfig(appConfig, { providers: runtimeProviders })).catch(
  (error: unknown) => {
    Sentry.captureException(error);
  },
);
