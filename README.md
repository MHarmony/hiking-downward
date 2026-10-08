# HikingDownward

[![CI](https://github.com/MHarmony/hiking-downward/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MHarmony/hiking-downward/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/MHarmony/hiking-downward?label=license)](LICENSE.md)
[![Contributor Covenant 3.0](https://img.shields.io/badge/Contributor_Covenant-3.0-5e0d73)](CODE_OF_CONDUCT.md)
![Bun](https://img.shields.io/badge/Bun-1.4.2-f9f1e1?logo=bun)
![Node.js](https://img.shields.io/badge/Node.js-26.11.1-339933?logo=nodedotjs)

HikingDownward is a re-imagined version of HikingUpward, built as an Angular and Nx workspace. The project is currently in active pre-1.0 development and may introduce breaking changes between releases.

## Requirements

- [Bun](https://bun.sh/) `1.4.2`
- Node.js `26.11.1`
- Git

## Getting started

Clone the repository, install dependencies, and install the Playwright browsers:

```sh
git clone https://github.com/MHarmony/hiking-downward.git
cd hiking-downward
bun install
bun playwright install --with-deps
```

Start the frontend locally:

```sh
bun nx serve @hiking-downward/frontend
```

The development server runs at <http://localhost:4200/> by default.

Start the API locally:

```sh
bun nx serve @hiking-downward/api
```

The development server runs at <http://localhost:3000/> by default.

The API and database libraries require PostgreSQL connection variables. Set
`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, and
`DATABASE_NAME` before starting the API. Authentication also uses Upstash Redis
and Resend; configure `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
`RESEND_API_KEY` for account email and session storage. `EMAIL_FROM` optionally
sets the transactional sender. `FRONTEND_URL` defaults to `http://localhost:4200`.

The API exposes `/health` as a liveness check and `/ready` as a PostgreSQL and
Redis readiness check. Readiness probes time out after one second. API Sentry
configuration is optional through `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
`SENTRY_RELEASE`, and `SENTRY_TRACES_SAMPLE_RATE`.

The frontend loads optional public Sentry settings from
`/runtime-config.json`. Deployments can replace the copied file without
rebuilding the Angular application.

Generate and apply database migrations with:

```sh
bun run db:generate
bun run db:migrate
```

The API enforces a 1 MiB request-body limit, generates an `X-Request-Id` for
each request, and returns normalized JSON errors for application routes while
preserving Better Auth responses.

CI runs migrations and both E2E projects. Configure the `BETTER_AUTH_SECRET`,
`UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` GitHub Actions secrets
for the API E2E job.

## Workspace structure

- `apps/frontend/` — Angular frontend application
- `apps/frontend-e2e/` — Playwright end-to-end tests
- `libs/frontend/account-settings/` — Profile, security, and account-management workflows
- `apps/api/` — Elysia API application
- `apps/api-e2e/` — Playwright end-to-end tests
- `libs/api/auth/` — Better Auth configuration and authentication workflows
- `libs/api/database/` — Drizzle database client and PostgreSQL schema
- `.github/` — GitHub workflows, issue forms, and repository policies
- `nx.json` — Nx task orchestration and release configuration

## Validation

Run the relevant Nx targets before opening a pull request:

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run e2e
```

For a focused change, Nx can run only affected projects:

```sh
bun nx affected -t lint typecheck test build e2e
```

## Commits and releases

Commit and pull request titles use [Conventional Commits](https://www.conventionalcommits.org/), for example:

```text
feat(frontend): add trail elevation summary
fix(frontend-e2e): stabilize title assertion
```

Release versioning, changelog generation, and library package publishing are configured through Nx Release. No automated release workflow is currently configured, so releases are maintained manually by project maintainers. Maintainers should use a locally configured signing key when creating release commits and tags.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Use the GitHub issue forms for bug reports and feature requests, and include the appropriate type and scope labels.

## Support and security

- General questions and troubleshooting: [SUPPORT.md](SUPPORT.md)
- Bug reports and feature requests: [GitHub Issues](https://github.com/MHarmony/hiking-downward/issues)
- Security vulnerabilities: [GitHub Security Advisories](https://github.com/MHarmony/hiking-downward/security/advisories/new)
- Community standards: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

HikingDownward is distributed under the [MIT License](LICENSE.md).
