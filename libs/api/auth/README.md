# `@hiking-downward/api-auth`

Shared Better Auth configuration for the HikingDownward API. The library
exports the configured `auth` instance used to mount authentication routes and
to resolve authenticated API sessions.

## Usage

```ts
import { auth } from '@hiking-downward/api-auth';

app.mount(auth.handler);
```

The configuration uses the `@hiking-downward/database` Drizzle client, Upstash Redis
for secondary storage and rate limiting, and Resend for verification,
password-reset, and magic-link email. Configure these variables before running
the API:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM` (optional; defaults to `HikingDownward <no-reply@mail.hikingdownward.com>`)
- `FRONTEND_URL` (optional; defaults to `http://localhost:4200`)

Better Auth trusts the configured `FRONTEND_URL`. Successful password-reset,
two-factor, and administrative operations are recorded in the application audit
table using best-effort writes. Tokens, passwords, and email bodies are not
stored in audit metadata.

Build the library from the workspace root with:

```sh
bun nx build @hiking-downward/api-auth
```
