# @hiking-downward/api-config

Shared runtime configuration for the HikingDownward API.

## Exports

- `apiConfig` — validated frontend URL, Sentry settings, and release identity
- `getApiConfig` — parses frontend and Sentry environment variables
- `getDatabaseConfig` — parses and validates PostgreSQL environment variables
- `getEmailConfig` — validates the Resend API key and sender identity

Database configuration requires:

- `DATABASE_HOST`
- `DATABASE_PORT` (1-65535)
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`

Email configuration requires:

- `RESEND_API_KEY`
- `EMAIL_FROM` (optional; defaults to `HikingDownward <no-reply@mail.hikingdownward.com>`)

API observability configuration is optional:

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT` (falls back to `NODE_ENV`)
- `SENTRY_RELEASE` (falls back to `GITHUB_SHA`, then `npm_package_version`, then `0.0.0`)
- `SENTRY_TRACES_SAMPLE_RATE` (defaults to `0.1`; must be between `0` and `1`)
