import * as fc from 'fast-check';

import { getApiConfig, getDatabaseConfig, getEmailConfig } from './config';

describe('getApiConfig', () => {
  it('uses the local frontend URL when none is configured', () => {
    expect(getApiConfig({})).toEqual({
      frontendUrl: 'http://localhost:4200',
      sentryEnvironment: 'development',
      sentryRelease: '0.0.0',
      sentryTracesSampleRate: 0.1,
    });
  }, 10_000);

  it('returns configured URLs', () => {
    expect(
      getApiConfig({
        FRONTEND_URL: 'https://hikingdownward.com',
        SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
        NODE_ENV: 'production',
        GITHUB_SHA: 'commit-sha',
      }),
    ).toEqual({
      frontendUrl: 'https://hikingdownward.com',
      sentryDsn: 'https://public@example.ingest.sentry.io/1',
      sentryEnvironment: 'production',
      sentryRelease: 'commit-sha',
      sentryTracesSampleRate: 0.1,
    });
  }, 10_000);

  it('rejects malformed URLs', () => {
    expect(() => getApiConfig({ FRONTEND_URL: 'not-a-url' })).toThrow(
      'Invalid URL in environment variable: FRONTEND_URL',
    );
  }, 10_000);

  it('validates the Sentry trace sample rate', () => {
    expect(getApiConfig({ SENTRY_TRACES_SAMPLE_RATE: '0.25' }).sentryTracesSampleRate).toBe(0.25);
    expect(() => getApiConfig({ SENTRY_TRACES_SAMPLE_RATE: '1.1' })).toThrow(
      'Invalid Sentry trace sample rate: SENTRY_TRACES_SAMPLE_RATE',
    );
  }, 10_000);

  it('falls back to the package version after the GitHub SHA', () => {
    expect(getApiConfig({ npm_package_version: '1.2.3' }).sentryRelease).toBe('1.2.3');
  }, 10_000);
});

describe('getDatabaseConfig', () => {
  const environment = {
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USER: 'hiker',
    DATABASE_PASSWORD: 'secret',
    DATABASE_NAME: 'hiking_downward',
  };

  it('returns configured database credentials', () => {
    expect(getDatabaseConfig(environment)).toEqual({
      host: 'localhost',
      port: 5432,
      user: 'hiker',
      password: 'secret',
      database: 'hiking_downward',
    });
  }, 10_000);

  it('rejects malformed database ports', () => {
    expect(() => getDatabaseConfig({ ...environment, DATABASE_PORT: '5432abc' })).toThrow(
      'Invalid port in environment variable: DATABASE_PORT',
    );
  }, 10_000);

  it('accepts every port in the PostgreSQL port range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 65_535 }), (port) => {
        expect(getDatabaseConfig({ ...environment, DATABASE_PORT: String(port) }).port).toBe(port);
      }),
    );
  }, 10_000);

  it('rejects every port outside the PostgreSQL port range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: 0 }),
          fc.integer({ min: 65_536 }),
          fc.double().filter((value) => !Number.isInteger(value) || !Number.isFinite(value)),
          fc.constantFrom('not-a-port', '5432abc'),
        ),
        (port) => {
          expect(() => getDatabaseConfig({ ...environment, DATABASE_PORT: String(port) })).toThrow(
            'Invalid port in environment variable: DATABASE_PORT',
          );
        },
      ),
    );
  }, 10_000);

  it('rejects missing database variables', () => {
    expect(() => getDatabaseConfig({ ...environment, DATABASE_PASSWORD: '' })).toThrow(
      'Missing required environment variable: DATABASE_PASSWORD',
    );
  }, 10_000);
});

describe('getEmailConfig', () => {
  it('returns the Resend API key', () => {
    expect(getEmailConfig({ RESEND_API_KEY: 're_test-key' })).toEqual({
      resendApiKey: 're_test-key',
      sender: 'HikingDownward <no-reply@mail.hikingdownward.com>',
    });
  }, 10_000);

  it('uses a configured transactional email sender', () => {
    expect(
      getEmailConfig({
        RESEND_API_KEY: 're_test-key',
        EMAIL_FROM: 'Trail Team <mail@example.com>',
      }),
    ).toEqual({
      resendApiKey: 're_test-key',
      sender: 'Trail Team <mail@example.com>',
    });
  }, 10_000);

  it('rejects a missing Resend API key', () => {
    expect(() => getEmailConfig({})).toThrow(
      'Missing required environment variable: RESEND_API_KEY',
    );
  }, 10_000);
});
