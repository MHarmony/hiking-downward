import * as Sentry from '@sentry/elysia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const noValue = null as never;

const {
  appInstances,
  authMock,
  checkDatabaseMock,
  checkRedisMock,
  closeDatabaseMock,
  closeRedisMock,
  corsMock,
  fromTypesMock,
  openapiMock,
  problemMock,
} = vi.hoisted(() => {
  const appInstances: Array<{ calls: Array<[string, unknown]>; config: Record<string, unknown> }> =
    [];

  return {
    appInstances,
    authMock: {
      api: {
        getSession: vi.fn<() => Promise<unknown>>(),
      },
      handler: { id: 'auth-handler' },
    },
    checkDatabaseMock: vi.fn<() => Promise<void>>(),
    checkRedisMock: vi.fn<() => Promise<void>>(),
    closeDatabaseMock: vi.fn<() => Promise<void>>(),
    closeRedisMock: vi.fn<() => Promise<void>>(),
    corsMock: vi.fn<
      (config: Record<string, unknown>) => { type: string; config: Record<string, unknown> }
    >((config) => ({
      type: 'cors',
      config,
    })),
    fromTypesMock: vi.fn<
      (
        typePath: string,
        config: Record<string, unknown>,
      ) => { typePath: string; config: Record<string, unknown> }
    >((typePath, config) => ({
      typePath,
      config,
    })),
    openapiMock: vi.fn<
      (config: Record<string, unknown>) => { type: string; config: Record<string, unknown> }
    >((config) => ({
      type: 'openapi',
      config,
    })),
    problemMock: vi.fn<(status: number, details?: Record<string, unknown>) => unknown>(
      (status, details = {}) => ({ status, ...details }),
    ),
  };
});

vi.mock('@elysia/cors', () => ({
  cors: corsMock,
}));
vi.mock('@elysia/openapi', () => ({
  fromTypes: fromTypesMock,
  openapi: openapiMock,
}));
vi.mock('@hiking-downward/api-auth', () => ({
  auth: authMock,
  checkRedis: checkRedisMock,
  closeRedis: closeRedisMock,
}));
vi.mock('@hiking-downward/database', () => ({
  checkDatabase: checkDatabaseMock,
  closeDatabase: closeDatabaseMock,
}));
vi.mock('elysia', () => {
  class Elysia {
    public calls: Array<[string, unknown]>;
    public config: Record<string, unknown>;

    public constructor(config: Record<string, unknown>) {
      this.config = config;
      this.calls = [];
      appInstances.push(this);
    }

    public use(value: unknown): this {
      this.calls.push(['use', value]);
      return this;
    }

    public get(path: string, options: unknown, handler?: unknown): this {
      this.calls.push(['get', [path, handler, options]]);
      return this;
    }

    public wrap(value: unknown): this {
      this.calls.push(['wrap', value]);
      return this;
    }

    public trace(...args: unknown[]): this {
      this.calls.push(['trace', args]);
      return this;
    }

    public onRequest(value: unknown): this {
      this.calls.push(['onRequest', value]);
      return this;
    }

    public request(value: unknown): this {
      this.calls.push(['request', value]);
      return this;
    }

    public onAfterHandle(value: unknown): this {
      this.calls.push(['onAfterHandle', value]);
      return this;
    }

    public afterHandle(value: unknown): this {
      this.calls.push(['afterHandle', value]);
      return this;
    }

    public onError(value: unknown): this {
      this.calls.push(['onError', value]);
      return this;
    }

    public error(value: unknown): this {
      this.calls.push(['error', value]);
      return this;
    }

    public mount(value: unknown): this {
      this.calls.push(['mount', value]);
      return this;
    }

    public all(path: string, handler: unknown): this {
      this.calls.push(['all', [path, handler]]);
      return this;
    }

    public macro(value: unknown): this {
      this.calls.push(['macro', value]);
      return this;
    }

    public listen(port: number): this {
      this.calls.push(['listen', port]);
      return this;
    }

    public async stop(): Promise<void> {
      this.calls.push(['stop', noValue]);
    }
  }

  class NotFound extends Error {}
  class ValidationError extends Error {}

  return { Elysia, NotFound, ValidationError, problem: problemMock };
});

describe('server', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    appInstances.length = 0;
    delete process.env['NODE_ENV'];
    checkDatabaseMock.mockResolvedValue(noValue);
    checkRedisMock.mockResolvedValue(noValue);
    closeDatabaseMock.mockResolvedValue(noValue);
    closeRedisMock.mockResolvedValue(noValue);
  });

  afterEach(async () => {
    delete process.env['NODE_ENV'];
    await Sentry.close();
  });

  it('configures the non-production Elysia app', async () => {
    process.env['NODE_ENV'] = 'test';

    await import('./server');

    const app = appInstances[0];
    expect(app).toBeTruthy();
    if (!app) {
      throw new Error('Expected app instance to be created');
    }
    expect(app.config).toMatchObject({
      name: 'HikingDownward API',
      strictPath: true,
      serve: { maxRequestBodySize: 1_048_576 },
    });
    expect(corsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: true,
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Request-Id',
          'sentry-trace',
          'baggage',
        ],
        exposeHeaders: ['X-Request-Id'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        origin: ['http://localhost:4200'],
      }),
    );
    expect(fromTypesMock).toHaveBeenCalledWith(
      'apps/api/src/main.ts',
      expect.objectContaining({
        projectRoot: expect.any(String),
        tsconfigPath: expect.stringMatching(/[\\/]apps[\\/]api[\\/]tsconfig\.app\.json$/),
      }),
    );
    expect(openapiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentation: expect.objectContaining({
          info: expect.objectContaining({
            title: 'HikingDownward API',
            version: '0.0.0',
          }),
        }),
      }),
    );
    const healthRoute = app.calls.find(
      ([name, value]) => name === 'get' && Array.isArray(value) && value[0] === '/health',
    );
    expect(healthRoute).toBeTruthy();
    if (!healthRoute || !Array.isArray(healthRoute[1])) {
      throw new Error('Expected health route to be registered');
    }
    const healthHandler = healthRoute[1][1] as () => { status: string };
    expect(healthHandler()).toEqual({ status: 'ok' });
    expect(healthRoute[1][2]).toMatchObject({
      detail: {
        summary: 'Check API health',
        responses: { 200: { description: 'The API process is responding.' } },
      },
    });
    expect(app.calls.some(([name]) => name === 'mount')).toBe(true);
    expect(app.calls).toContainEqual(['listen', 3000]);

    const requestEntry = app.calls.find(([name]) => name === 'request');
    expect(requestEntry).toBeTruthy();
    if (!requestEntry) {
      throw new Error('Expected request hook to be registered');
    }
    const requestHook = requestEntry[1] as (input: {
      request: Request;
      set: { headers: Record<string, string> };
    }) => unknown;
    const requestSet: { headers: Record<string, string> } = { headers: {} };
    requestHook({ request: new Request('http://localhost/health'), set: requestSet });
    expect(requestSet.headers['X-Request-Id']).toEqual(expect.any(String));

    expect(
      requestHook({
        request: new Request('http://localhost/docs'),
        set: { headers: {} },
      }),
    ).toBeNull();

    const oversizedSet: { headers: Record<string, string> } = { headers: {} };
    expect(
      requestHook({
        request: new Request('http://localhost/health', {
          headers: { 'content-length': '1048577' },
        }),
        set: oversizedSet,
      }),
    ).toMatchObject({
      status: 413,
      title: 'Payload Too Large',
      detail: 'Request body exceeds the maximum size',
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the maximum size',
        requestId: oversizedSet.headers['X-Request-Id'],
      },
    });

    expect(
      requestHook({
        request: new Request('http://localhost/does-not-exist'),
        set: { headers: {} },
      }),
    ).toMatchObject({
      status: 404,
      title: 'Not Found',
      detail: 'Route not found',
      error: { code: 'NOT_FOUND', message: 'Route not found', requestId: expect.any(String) },
    });

    const readyRoute = app.calls.find(
      ([name, value]) => name === 'get' && Array.isArray(value) && value[0] === '/ready',
    );
    expect(readyRoute).toBeTruthy();
    if (!readyRoute || !Array.isArray(readyRoute[1])) {
      throw new Error('Expected readiness route to be registered');
    }
    expect(readyRoute[1][2]).toMatchObject({
      detail: {
        summary: 'Check API readiness',
        responses: {
          200: { description: 'The API and all dependencies are ready.' },
          503: {
            description: 'The API is responding, but at least one dependency is unavailable.',
          },
        },
      },
    });
    const readyHandler = readyRoute[1] as [string, (input: unknown) => Promise<unknown>];
    await expect(readyHandler[1]({})).resolves.toEqual({
      status: 'ready',
      dependencies: { postgres: 'ok', redis: 'ok' },
    });

    checkRedisMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(readyHandler[1]({})).resolves.toEqual({
      status: 503,
      title: 'Service Unavailable',
      detail: 'PostgreSQL and Redis are not ready.',
      readiness: 'not_ready',
      dependencies: { postgres: 'ok', redis: 'down' },
    });
    expect(problemMock).toHaveBeenCalledWith(503, {
      title: 'Service Unavailable',
      detail: 'PostgreSQL and Redis are not ready.',
      readiness: 'not_ready',
      dependencies: { postgres: 'ok', redis: 'down' },
    });

    checkDatabaseMock.mockRejectedValueOnce(new Error('postgres down'));
    checkRedisMock.mockResolvedValueOnce(noValue);
    await expect(readyHandler[1]({})).resolves.toEqual({
      status: 503,
      title: 'Service Unavailable',
      detail: 'PostgreSQL and Redis are not ready.',
      readiness: 'not_ready',
      dependencies: { postgres: 'down', redis: 'ok' },
    });

    vi.useFakeTimers();
    checkDatabaseMock.mockImplementation(async () => new Promise(() => noValue));
    const pendingReady = readyHandler[1]({});
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pendingReady).resolves.toEqual({
      status: 503,
      title: 'Service Unavailable',
      detail: 'PostgreSQL and Redis are not ready.',
      readiness: 'not_ready',
      dependencies: { postgres: 'down', redis: 'ok' },
    });
    vi.useRealTimers();

    const afterHandleEntry = app.calls.find(([name]) => name === 'afterHandle');
    expect(afterHandleEntry).toBeTruthy();
    if (!afterHandleEntry) {
      throw new Error('Expected response hook to be registered');
    }
    const afterHandle = afterHandleEntry[1] as (input: {
      set: { headers: Record<string, string> };
    }) => void;
    const responseSet = { headers: {} };
    afterHandle({ set: responseSet });
    expect(responseSet.headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    });

    const errorEntry = app.calls.find(([name]) => name === 'error');
    expect(errorEntry).toBeTruthy();
    if (!errorEntry) {
      throw new Error('Expected error hook to be registered');
    }
    const normalizeError = errorEntry[1] as (input: {
      error: Error;
      request: Request;
      set: { headers: Record<string, string>; status: number };
    }) => unknown;
    const { NotFound, ValidationError } = (await import('elysia')) as unknown as {
      NotFound: new () => Error;
      ValidationError: new () => Error;
    };
    const errorSet = { headers: { 'X-Request-Id': 'request-id' }, status: 200 };
    expect(
      normalizeError({
        error: new ValidationError(),
        request: new Request('http://localhost/invalid'),
        set: errorSet,
      }),
    ).toMatchObject({
      status: 400,
      title: 'Bad Request',
      detail: 'Request validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId: 'request-id',
      },
    });
    expect(errorSet.status).toBe(200);
    expect(
      normalizeError({
        error: new NotFound(),
        request: new Request('http://localhost/missing'),
        set: { headers: { 'X-Request-Id': 'request-id' }, status: 200 },
      }),
    ).toMatchObject({
      status: 404,
      title: 'Not Found',
      detail: 'Route not found',
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: 'request-id',
      },
    });
    expect(
      normalizeError({
        error: new NotFound(),
        request: new Request('http://localhost/api/auth/missing'),
        set: { headers: { 'X-Request-Id': 'request-id' }, status: 404 },
      }),
    ).toBeUndefined();

    const internalErrorSet = { headers: { 'X-Request-Id': 'request-id' }, status: 200 };
    expect(
      normalizeError({
        error: new Error('unknown'),
        request: new Request('http://localhost/boom'),
        set: internalErrorSet,
      }),
    ).toMatchObject({
      status: 500,
      title: 'Internal Server Error',
      detail: 'Internal server error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'request-id',
      },
    });
    expect(internalErrorSet.status).toBe(200);

    const existingStatusSet = { headers: { 'X-Request-Id': 'request-id' }, status: 401 };
    normalizeError({
      error: new Error('unknown'),
      request: new Request('http://localhost/forbidden'),
      set: existingStatusSet,
    });
    expect(existingStatusSet.status).toBe(401);
    expect(problemMock).toHaveBeenLastCalledWith(
      401,
      expect.objectContaining({ title: 'Internal Server Error' }),
    );

    const { shutdownServer } = await import('./server');
    await shutdownServer();
    process.emit('SIGTERM');
    expect(closeDatabaseMock).toHaveBeenCalledOnce();
    expect(closeRedisMock).toHaveBeenCalledOnce();
  }, 10_000);

  it('configures the source Elysia app with source type metadata', async () => {
    process.env['NODE_ENV'] = 'production';

    await import('./server');

    expect(fromTypesMock).toHaveBeenCalledWith(
      'apps/api/src/main.ts',
      expect.objectContaining({
        projectRoot: expect.any(String),
        tsconfigPath: expect.stringMatching(/[\\/]apps[\\/]api[\\/]tsconfig\.app\.json$/),
      }),
    );
    const app = appInstances[0];
    expect(app).toBeTruthy();
    if (!app) {
      throw new Error('Expected app instance to be created');
    }
    expect(app.calls).toContainEqual(['listen', 3000]);
  }, 10_000);

  it('consumes shutdown failures from the SIGTERM handler', async () => {
    process.env['NODE_ENV'] = 'test';
    closeDatabaseMock.mockRejectedValueOnce(new Error('database close failed'));

    await import('./server');
    process.emit('SIGTERM');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(closeDatabaseMock).toHaveBeenCalled();
  }, 10_000);

  it('returns a 401 when no session is present and a session payload otherwise', async () => {
    process.env['NODE_ENV'] = 'test';

    await import('./server');

    const app = appInstances[0];
    expect(app).toBeTruthy();
    if (!app) {
      throw new Error('Expected app instance to be created');
    }
    const macroEntry = app.calls.find(([name]) => name === 'macro');
    if (!macroEntry) {
      throw new Error('Expected macro configuration to be registered');
    }
    const macroConfig = macroEntry[1] as {
      auth: {
        derive: (input: { request: { headers: Record<string, string> } }) => Promise<unknown>;
      };
    };
    const derive = macroConfig.auth.derive;
    problemMock.mockClear();

    authMock.api.getSession.mockResolvedValueOnce(null);
    await expect(
      derive({
        request: { headers: { Authorization: 'Bearer missing' } },
      }),
    ).resolves.toEqual({
      status: 401,
      title: 'Unauthorized',
      detail: 'Authentication is required.',
    });
    expect(problemMock).toHaveBeenCalledWith(401, {
      title: 'Unauthorized',
      detail: 'Authentication is required.',
    });

    const user = { id: 'user-1' };
    const session = { id: 'session-1' };
    authMock.api.getSession.mockResolvedValueOnce({ user, session });
    await expect(
      derive({
        request: { headers: { Authorization: 'Bearer present' } },
      }),
    ).resolves.toEqual({ user, session });
  }, 10_000);
});
