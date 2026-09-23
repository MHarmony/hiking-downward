import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { drizzleMock, poolMock } = vi.hoisted(() => ({
  drizzleMock: vi.fn<() => { connected: boolean }>(() => ({ connected: true })),
  poolMock: {
    end: vi.fn<() => Promise<void>>().mockResolvedValue(null as never),
    query: vi.fn<() => Promise<void>>().mockResolvedValue(null as never),
  },
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: drizzleMock,
}));
vi.mock('pg', () => ({
  Pool: class {
    public end = poolMock.end;
    public query = poolMock.query;
  },
}));

const databaseEnv = {
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'hiker',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'hiking_downward',
} as const;

const databaseEnvKeys = Object.keys(databaseEnv) as Array<keyof typeof databaseEnv>;

describe('database', () => {
  beforeEach(() => {
    vi.resetModules();
    drizzleMock.mockClear();
    poolMock.end.mockClear();
    poolMock.query.mockClear();

    for (const [key, value] of Object.entries(databaseEnv)) {
      vi.stubEnv(key, value);
    }
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('creates a drizzle database with configured connection details', async () => {
    const { db } = await import('./database');
    const { relations } = await import('./schema/relations.schema');

    expect(db).toEqual({ connected: true });
    expect(drizzleMock).toHaveBeenCalledTimes(1);
    expect(drizzleMock).toHaveBeenCalledWith({ client: poolMock, relations });
  }, 10_000);

  it('checks PostgreSQL and closes the pool idempotently', async () => {
    const { checkDatabase, closeDatabase } = await import('./database');

    await checkDatabase();
    await closeDatabase();
    await closeDatabase();

    expect(poolMock.query).toHaveBeenCalledWith('select 1');
    expect(poolMock.end).toHaveBeenCalledOnce();
  }, 10_000);

  it.each(databaseEnvKeys)(
    'throws when %s is missing',
    async (key) => {
      vi.stubEnv(key, '');

      await expect(import('./database')).rejects.toThrow(
        `Missing required environment variable: ${key}`,
      );
    },
    10_000,
  );
});
