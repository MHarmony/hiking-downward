import { defineConfig } from 'drizzle-kit';
// oxlint-disable-next-line @nx/enforce-module-boundaries
import { getDatabaseConfig } from '../config/src/lib/config';

const databaseConfig = getDatabaseConfig();

/** Drizzle Kit configuration for the HikingDownward PostgreSQL database. */
export default defineConfig({
  out: './libs/api/database/drizzle',
  schema: './libs/api/database/src/lib/schema',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: {
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    ssl: false,
  },
});
