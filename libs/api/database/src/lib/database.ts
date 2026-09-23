import { getDatabaseConfig } from '@seahawk/api-config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { relations } from './schema/relations.schema';

const databaseConfig = getDatabaseConfig();

/** PostgreSQL pool shared by Drizzle and the API readiness check. */
export const pool = new Pool({
  application_name: 'HikingDownward',
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,
  options: '--client_encoding=utf8',
});

/** Drizzle database client configured for the application's PostgreSQL database. */
export const db: NodePgDatabase<typeof relations> = drizzle({
  client: pool,
  relations,
});

/**
 * Checks that PostgreSQL accepts a trivial query.
 *
 * @returns A promise that resolves when PostgreSQL responds successfully.
 * @throws The pool query error when PostgreSQL is unavailable.
 */
export async function checkDatabase(): Promise<void> {
  await pool.query('select 1');
}

let closePromise: Promise<void> | null = null;

/**
 * Closes the shared PostgreSQL pool at most once.
 *
 * @returns A promise that resolves after the pool closes.
 * @throws The pool shutdown error when PostgreSQL cannot close cleanly.
 */
export async function closeDatabase(): Promise<void> {
  closePromise ??= pool.end();
  return closePromise;
}
