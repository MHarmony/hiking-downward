/** Bootstraps the HikingDownward Angular application. */
import { bootstrapApplication } from '@angular/platform-browser';
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
    tracesSampleRate: runtimeConfig.sentryTracesSampleRate ?? 0.1,
  });
}

bootstrapApplication(App, appConfig).catch((error: unknown) => {
  Sentry.captureException(error);
});
