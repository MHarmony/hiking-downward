const defaultFrontendUrl = 'http://localhost:4200';
const defaultEmailSender = 'HikingDownward <no-reply@mharmony.io>';
const defaultSentryTraceSampleRate = 0.1;

/** Runtime configuration used by the API server. */
export type ApiConfig = {
  /** URL allowed to make credentialed API requests. */
  frontendUrl: string;
  /** Optional DSN used to report API errors to Sentry. */
  sentryDsn?: string;
  /** Deployment environment reported to Sentry. */
  sentryEnvironment: string;
  /** Release identifier reported to Sentry. */
  sentryRelease: string;
  /** Fraction of transactions sampled by Sentry. */
  sentryTracesSampleRate: number;
};

/** PostgreSQL connection settings used by Drizzle. */
export type DatabaseConfig = {
  /** PostgreSQL host name or address. */
  host: string;
  /** PostgreSQL TCP port. */
  port: number;
  /** PostgreSQL user name. */
  user: string;
  /** PostgreSQL password. */
  password: string;
  /** PostgreSQL database name. */
  database: string;
};

/** Resend credentials used by transactional email. */
export type EmailConfig = {
  /** Resend API key. */
  resendApiKey: string;
  /** Sender identity used for transactional email. */
  sender: string;
};

/**
 * Reads a required non-empty environment variable.
 *
 * @param name Environment variable name.
 * @param env Environment values to read.
 * @returns The configured environment value.
 * @throws An error when the variable is missing or empty.
 */
function requiredString(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/**
 * Reads and validates a required PostgreSQL port.
 *
 * @param name Environment variable name.
 * @param env Environment values to read.
 * @returns The validated port number.
 * @throws An error when the variable is missing or outside the valid port range.
 */
function requiredPort(name: string, env: NodeJS.ProcessEnv): number {
  const value = requiredString(name, env);
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port in environment variable: ${name}`);
  }

  return port;
}

/**
 * Validates an environment variable containing a URL.
 *
 * @param name Environment variable name.
 * @param value URL value to validate.
 * @returns The validated URL.
 * @throws An error when the value is not a valid URL.
 */
function requiredUrl(name: string, value: string): string {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL in environment variable: ${name}`);
  }

  return value;
}

/**
 * Validates an optional URL when an environment variable is present.
 *
 * @param name Environment variable name.
 * @param value Optional URL value to validate.
 * @returns The validated URL, or `undefined` when no value is provided.
 * @throws An error when the provided value is not a valid URL.
 */
function optionalUrl(name: string, value: string | undefined): string | undefined {
  if (!value) {
    return;
  }

  return requiredUrl(name, value);
}

/**
 * Reads and validates a Sentry trace sample rate between zero and one.
 *
 * @param env Environment values to read.
 * @returns The configured sample rate, or the default rate.
 * @throws An error when the configured rate is outside the inclusive range.
 */
function sentryTraceSampleRate(env: NodeJS.ProcessEnv): number {
  const value = env['SENTRY_TRACES_SAMPLE_RATE'];

  if (!value) {
    return defaultSentryTraceSampleRate;
  }

  const sampleRate = Number(value);
  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    throw new Error('Invalid Sentry trace sample rate: SENTRY_TRACES_SAMPLE_RATE');
  }

  return sampleRate;
}

/**
 * Reads and validates API server configuration.
 *
 * @param env Environment values to read.
 * @returns The validated API configuration.
 * @throws An error when a configured URL is invalid.
 */
export function getApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const sentryDsn = optionalUrl('SENTRY_DSN', env['SENTRY_DSN']);
  const result: ApiConfig = {
    frontendUrl: requiredUrl('FRONTEND_URL', env['FRONTEND_URL'] || defaultFrontendUrl),
    sentryEnvironment: env['SENTRY_ENVIRONMENT'] || env['NODE_ENV'] || 'development',
    sentryRelease:
      env['SENTRY_RELEASE'] || env['GITHUB_SHA'] || env['npm_package_version'] || '0.0.0',
    sentryTracesSampleRate: sentryTraceSampleRate(env),
  };

  if (sentryDsn) {
    result.sentryDsn = sentryDsn;
  }

  return result;
}

/**
 * Reads and validates PostgreSQL connection configuration.
 *
 * @param env Environment values to read.
 * @returns The validated database configuration.
 * @throws An error when a required value is missing or the port is invalid.
 */
export function getDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return {
    host: requiredString('DATABASE_HOST', env),
    port: requiredPort('DATABASE_PORT', env),
    user: requiredString('DATABASE_USER', env),
    password: requiredString('DATABASE_PASSWORD', env),
    database: requiredString('DATABASE_NAME', env),
  };
}

/**
 * Reads and validates transactional email configuration.
 *
 * @param env Environment values to read.
 * @returns The validated email configuration.
 * @throws An error when the Resend API key is missing or empty.
 */
export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  return {
    resendApiKey: requiredString('RESEND_API_KEY', env),
    sender: env['EMAIL_FROM'] || defaultEmailSender,
  };
}

/** Validated API server configuration for the current process environment. */
export const apiConfig = getApiConfig();
