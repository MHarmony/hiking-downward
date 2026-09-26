/** Public runtime settings loaded by the browser before Angular bootstraps. */
export type FrontendRuntimeConfig = {
  /** Base URL of the API / better-auth server. */
  apiUrl?: string;
  /** Public Sentry DSN, when frontend error reporting is enabled. */
  sentryDsn?: string;
  /** Deployment environment reported to Sentry. */
  sentryEnvironment?: string;
  /** Release identifier reported to Sentry. */
  sentryRelease?: string;
  /** Fraction of frontend transactions sampled by Sentry. */
  sentryTracesSampleRate?: number;
  /** Origins that receive Sentry trace headers; defaults to `apiUrl`. */
  sentryTracePropagationTargets?: string[];
};

const defaultRuntimeConfig: FrontendRuntimeConfig = {};

/**
 * Loads optional public deployment settings without blocking local development.
 *
 * @returns The parsed runtime settings, or an empty configuration when loading fails.
 */
export async function loadRuntimeConfig(): Promise<FrontendRuntimeConfig> {
  try {
    const response = await fetch('/runtime-config.json', { cache: 'no-store' });
    if (!response.ok) {
      return defaultRuntimeConfig;
    }

    const config: unknown = await response.json();
    if (!config || typeof config !== 'object') {
      return defaultRuntimeConfig;
    }

    return config as FrontendRuntimeConfig;
  } catch {
    return defaultRuntimeConfig;
  }
}
