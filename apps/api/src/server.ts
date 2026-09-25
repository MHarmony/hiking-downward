import { cors } from '@elysia/cors';
import { node } from '@elysia/node';
import { fromTypes, openapi } from '@elysia/openapi';
import { auth, checkRedis, closeRedis } from '@hiking-downward/api-auth';
import { apiConfig } from '@hiking-downward/api-config';
import { checkDatabase, closeDatabase } from '@hiking-downward/database';
import * as Sentry from '@sentry/elysia';
import { Elysia, type AnyElysia, type ErrorHandler } from 'elysia';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

Sentry.init({
  dsn: apiConfig.sentryDsn,
  environment: apiConfig.sentryEnvironment,
  release: apiConfig.sentryRelease,
  dataCollection: {
    userInfo: false,
  },
  tracesSampleRate: apiConfig.sentryTracesSampleRate,
});

/* v8 ignore next: built e2e serves the OpenAPI document without source references. */
const openApiTypeReferences = import.meta.url.endsWith('.mjs')
  ? {}
  : {
      references: fromTypes('apps/api/src/main.ts', {
        projectRoot: path.resolve(import.meta.dirname, '../../..'),
        tsconfigPath: path.resolve(import.meta.dirname, '../../..', 'apps/api/tsconfig.app.json'),
      }),
    };

const readinessTimeoutMs = 1_000;
const maxRequestBodySize = 1_048_576;

/**
 * Runs a dependency probe within the readiness deadline.
 *
 * @param check Asynchronous dependency probe to execute.
 * @returns `true` when the probe completes before the deadline; otherwise `false`.
 */
async function checkDependency(check: () => Promise<void>): Promise<boolean> {
  try {
    await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Readiness check timed out')), readinessTimeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts non-authentication errors into the public API error envelope.
 *
 * @param context Elysia error context containing the request and response state.
 * @returns The normalized error payload, or `undefined` for Better Auth errors.
 */
const normalizeError: ErrorHandler = (context) => {
  const { code, request, set } = context as unknown as {
    code: string;
    request: Request;
    set: { headers: Record<string, string | number>; status: number };
  };
  if (new URL(request.url).pathname.startsWith('/api/auth')) {
    return;
  }

  const requestId = set.headers['X-Request-Id'];
  const isNotFound = code === 'NOT_FOUND';
  const statusCode =
    set.status === 200 ? (code === 'VALIDATION' ? 400 : isNotFound ? 404 : 500) : set.status;
  set.status = statusCode;
  return {
    error: {
      code:
        code === 'VALIDATION' ? 'VALIDATION_ERROR' : isNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message:
        code === 'VALIDATION'
          ? 'Request validation failed'
          : isNotFound
            ? 'Route not found'
            : 'Internal server error',
      requestId,
    },
  };
};

/**
 * Creates the configured Elysia application without starting its listener.
 *
 * @returns The configured Elysia application instance.
 */
export function createApp(): AnyElysia {
  return new Elysia({
    adapter: node(),
    aot: true,
    name: 'HikingDownward API',
    strictPath: true,
    serve: { maxRequestBodySize },
  })
    .onRequest(({ request, set, status }) => {
      set.headers['X-Request-Id'] = randomUUID();

      const contentLength = Number(request.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxRequestBodySize) {
        return status(413, {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds the maximum size',
            requestId: set.headers['X-Request-Id'],
          },
        });
      }

      const path = new URL(request.url).pathname;
      const isKnownRoute =
        path === '/health' ||
        path === '/ready' ||
        path.startsWith('/api/auth/') ||
        path.startsWith('/openapi/');
      if (!isKnownRoute) {
        return status(404, {
          error: {
            code: 'NOT_FOUND',
            message: 'Route not found',
            requestId: set.headers['X-Request-Id'],
          },
        });
      }

      return null;
    })
    .use(
      cors({
        origin: [apiConfig.frontendUrl],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposeHeaders: ['X-Request-Id'],
      }),
    )
    .onAfterHandle(({ set }) => {
      set.headers['X-Content-Type-Options'] = 'nosniff';
      set.headers['Referrer-Policy'] = 'no-referrer';
      set.headers['X-Frame-Options'] = 'DENY';
      set.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';
    })
    .onError(normalizeError as never)
    .get('/health', () => ({ status: 'ok' }))
    .get('/ready', async ({ status }) => {
      const [postgres, redis] = await Promise.all([
        checkDependency(checkDatabase),
        checkDependency(checkRedis),
      ]);
      const body = {
        status: postgres && redis ? 'ready' : 'not_ready',
        dependencies: { postgres: postgres ? 'ok' : 'down', redis: redis ? 'ok' : 'down' },
      } as const;

      return postgres && redis ? body : status(503, body);
    })
    .use(
      openapi({
        documentation: {
          info: {
            title: 'HikingDownward API',
            version: '0.0.0',
            contact: {
              email: 'contact@hikingdownward.com',
              name: 'HikingDownward Support',
              url: 'https://hikingdownward.com/contact',
            },
            description: 'A re-imagined version of HikingUpward.',
            license: {
              name: 'MIT',
            },
          },
        },
        ...openApiTypeReferences,
      }),
    )
    .mount(auth.handler)
    .macro({
      auth: {
        async resolve({ status, request: { headers } }) {
          const session = await auth.api.getSession({
            headers,
          });

          if (!session) {
            return status(401);
          }

          return {
            user: session.user,
            session: session.session,
          };
        },
      },
    });
}

/** Configured Elysia application for the HikingDownward API server. */
export const app = Sentry.withElysia(createApp())
  .onError(normalizeError as never)
  .listen(3000);

let shutdownPromise: Promise<void> | null = null;

/**
 * Stops the API and releases process-owned resources exactly once.
 *
 * @returns A promise that resolves after the listener and dependencies close.
 */
export async function shutdownServer(): Promise<void> {
  shutdownPromise ??= Promise.all([app.stop(), closeDatabase(), closeRedis()]).then(async () =>
    Promise.resolve(),
  );
  return shutdownPromise;
}

process.once('SIGTERM', () => {
  shutdownServer().catch(async () => Promise.resolve());
});
