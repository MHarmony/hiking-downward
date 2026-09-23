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
  };
});

vi.mock('@elysia/cors', () => ({
  cors: corsMock,
}));
vi.mock('@elysia/openapi', () => ({
  fromTypes: fromTypesMock,
  openapi: openapiMock,
}));
vi.mock('@seahawk/api-auth', () => ({
  auth: authMock,
  checkRedis: checkRedisMock,
  closeRedis: closeRedisMock,
}));
vi.mock('@seahawk/database', () => ({
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

    public get(path: string, handler: unknown): this {
      this.calls.push(['get', [path, handler]]);
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

    public onAfterHandle(value: unknown): this {
      this.calls.push(['onAfterHandle', value]);
      return this;
    }

    public onError(value: unknown): this {
      this.calls.push(['onError', value]);
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

  return { Elysia };
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

  afterEach(() => {
    delete process.env['NODE_ENV'];
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
      aot: true,
      name: 'HikingDownward API',
      strictPath: true,
      serve: { maxRequestBodySize: 1_048_576 },
    });
    expect(corsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposeHeaders: ['X-Request-Id'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        origin: ['http://localhost:4200'],
      }),
    );
    expect(fromTypesMock).toHaveBeenCalledWith(
      'apps/api/src/main.ts',
      expect.objectContaining({
        projectRoot: expect.any(String),
        tsconfigPath: expect.stringContaining('apps/api/tsconfig.app.json'),
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
    expect(app.calls.some(([name]) => name === 'mount')).toBe(true);
    expect(app.calls).toContainEqual(['listen', 3000]);

    const onRequestEntry = app.calls.find(([name]) => name === 'onRequest');
    expect(onRequestEntry).toBeTruthy();
    if (!onRequestEntry) {
      throw new Error('Expected request hook to be registered');
    }
    const onRequest = onRequestEntry[1] as (input: {
      request: Request;
      set: { headers: Record<string, string> };
      status: (code: number, body: unknown) => unknown;
    }) => unknown;
    const requestSet: { headers: Record<string, string> } = { headers: {} };
    const status = vi.fn<(code: number, body: unknown) => unknown>((_code, body) => body);
    onRequest({ request: new Request('http://localhost/health'), set: requestSet, status });
    expect(requestSet.headers['X-Request-Id']).toEqual(expect.any(String));

    const oversizedSet: { headers: Record<string, string> } = { headers: {} };
    expect(
      onRequest({
        request: new Request('http://localhost/health', {
          headers: { 'content-length': '1048577' },
        }),
        set: oversizedSet,
        status,
      }),
    ).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the maximum size',
        requestId: oversizedSet.headers['X-Request-Id'],
      },
    });

    expect(
      onRequest({
        request: new Request('http://localhost/does-not-exist'),
        set: { headers: {} },
        status,
      }),
    ).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found', requestId: expect.any(String) },
    });

    const readyRoute = app.calls.find(
      ([name, value]) => name === 'get' && Array.isArray(value) && value[0] === '/ready',
    );
    expect(readyRoute).toBeTruthy();
    if (!readyRoute || !Array.isArray(readyRoute[1])) {
      throw new Error('Expected readiness route to be registered');
    }
    const readyHandler = readyRoute[1] as [string, (input: unknown) => Promise<unknown>];
    await expect(readyHandler[1]({ status })).resolves.toEqual({
      status: 'ready',
      dependencies: { postgres: 'ok', redis: 'ok' },
    });

    checkRedisMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(readyHandler[1]({ status })).resolves.toEqual({
      status: 'not_ready',
      dependencies: { postgres: 'ok', redis: 'down' },
    });
    expect(status).toHaveBeenCalledWith(503, {
      status: 'not_ready',
      dependencies: { postgres: 'ok', redis: 'down' },
    });

    checkDatabaseMock.mockRejectedValueOnce(new Error('postgres down'));
    checkRedisMock.mockResolvedValueOnce(noValue);
    await expect(readyHandler[1]({ status })).resolves.toEqual({
      status: 'not_ready',
      dependencies: { postgres: 'down', redis: 'ok' },
    });

    vi.useFakeTimers();
    checkDatabaseMock.mockImplementation(async () => new Promise(() => noValue));
    const pendingReady = readyHandler[1]({ status });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pendingReady).resolves.toEqual({
      status: 'not_ready',
      dependencies: { postgres: 'down', redis: 'ok' },
    });
    vi.useRealTimers();

    const onAfterHandleEntry = app.calls.find(([name]) => name === 'onAfterHandle');
    expect(onAfterHandleEntry).toBeTruthy();
    if (!onAfterHandleEntry) {
      throw new Error('Expected response hook to be registered');
    }
    const onAfterHandle = onAfterHandleEntry[1] as (input: {
      set: { headers: Record<string, string> };
    }) => void;
    const responseSet = { headers: {} };
    onAfterHandle({ set: responseSet });
    expect(responseSet.headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    });

    const onErrorEntry = app.calls.find(([name]) => name === 'onError');
    expect(onErrorEntry).toBeTruthy();
    if (!onErrorEntry) {
      throw new Error('Expected error hook to be registered');
    }
    const onError = onErrorEntry[1] as (input: {
      code: string;
      request: Request;
      set: { headers: Record<string, string>; status: number };
    }) => unknown;
    const errorSet = { headers: { 'X-Request-Id': 'request-id' }, status: 200 };
    expect(
      onError({
        code: 'VALIDATION',
        request: new Request('http://localhost/invalid'),
        set: errorSet,
      }),
    ).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId: 'request-id',
      },
    });
    expect(errorSet.status).toBe(400);
    expect(
      onError({
        code: 'NOT_FOUND',
        request: new Request('http://localhost/missing'),
        set: { headers: { 'X-Request-Id': 'request-id' }, status: 200 },
      }),
    ).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: 'request-id',
      },
    });
    expect(
      onError({
        code: 'NOT_FOUND',
        request: new Request('http://localhost/api/auth/missing'),
        set: { headers: { 'X-Request-Id': 'request-id' }, status: 404 },
      }),
    ).toBeUndefined();

    const internalErrorSet = { headers: { 'X-Request-Id': 'request-id' }, status: 200 };
    expect(
      onError({
        code: 'UNKNOWN',
        request: new Request('http://localhost/boom'),
        set: internalErrorSet,
      }),
    ).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'request-id',
      },
    });
    expect(internalErrorSet.status).toBe(500);

    const existingStatusSet = { headers: { 'X-Request-Id': 'request-id' }, status: 401 };
    onError({
      code: 'UNKNOWN',
      request: new Request('http://localhost/forbidden'),
      set: existingStatusSet,
    });
    expect(existingStatusSet.status).toBe(401);

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
        tsconfigPath: expect.stringContaining('apps/api/tsconfig.app.json'),
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
        resolve: (input: {
          status: (code: number) => number;
          request: { headers: Record<string, string> };
        }) => Promise<number | { user: object; session: object }>;
      };
    };
    const resolve = macroConfig.auth.resolve;
    const status = vi.fn<(code: number) => number>((code) => code);

    authMock.api.getSession.mockResolvedValueOnce(null);
    await expect(
      resolve({
        status,
        request: { headers: { Authorization: 'Bearer missing' } },
      }),
    ).resolves.toBe(401);
    expect(status).toHaveBeenCalledWith(401);

    const user = { id: 'user-1' };
    const session = { id: 'session-1' };
    authMock.api.getSession.mockResolvedValueOnce({ user, session });
    await expect(
      resolve({
        status,
        request: { headers: { Authorization: 'Bearer present' } },
      }),
    ).resolves.toEqual({ user, session });
  }, 10_000);
});
