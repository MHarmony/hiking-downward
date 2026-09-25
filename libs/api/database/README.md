# `@hiking-downward/database`

Shared PostgreSQL access for the HikingDownward API. The library provides the
typed Drizzle client and the Better Auth schema used by the authentication
library.

## Exports

- `db` — configured Drizzle PostgreSQL client
- `user`, `account`, `passkey`, and `twoFactor` — Better Auth tables
- `hikingDownwardSchema` and `betterAuthSchema` — PostgreSQL schemas

The client uses `getDatabaseConfig` from `@hiking-downward/api-config` to validate:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`

Generate or apply migrations from the workspace root:

```sh
bun run db:generate
bun run db:migrate
```

Build the library with:

```sh
bun nx build @hiking-downward/database
```
