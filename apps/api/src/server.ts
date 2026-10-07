import { cors } from '@elysia/cors';
import { node } from '@elysia/node';
import { fromTypes, openapi } from '@elysia/openapi';
import { auth, checkRedis, closeRedis } from '@hiking-downward/api-auth';
import { apiConfig } from '@hiking-downward/api-config';
import { checkDatabase, closeDatabase } from '@hiking-downward/database';
import * as Sentry from '@sentry/elysia';
import { Elysia, NotFound, ValidationError, problem, type AnyElysia } from 'elysia';
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
const normalizeError = (context: { error: unknown }): unknown => {
  const { error } = context;
  const { request, set } = context as typeof context & {
    request: Request;
    set: { headers: Record<string, string | number>; status: number };
  };
  if (new URL(request.url).pathname.startsWith('/api/auth')) {
    return;
  }

  const requestId = set.headers['X-Request-Id'];
  const isValidation = error instanceof ValidationError;
  const isNotFound = error instanceof NotFound;
  const statusCode =
    set.status === 200 ? (isValidation ? 400 : isNotFound ? 404 : 500) : set.status;
  const code = isValidation ? 'VALIDATION_ERROR' : isNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR';
  const message = isValidation
    ? 'Request validation failed'
    : isNotFound
      ? 'Route not found'
      : 'Internal server error';
  const title = isValidation ? 'Bad Request' : isNotFound ? 'Not Found' : 'Internal Server Error';

  return problem(statusCode, {
    title,
    detail: message,
    requestId,
    error: { code, message, requestId },
  });
};

/**
 * Creates the configured Elysia application without starting its listener.
 *
 * @returns The configured Elysia application instance.
 */
export function createApp(): AnyElysia {
  return new Elysia({
    adapter: node(),
    name: 'HikingDownward API',
    strictPath: true,
    serve: { maxRequestBodySize },
  })
    .request(({ request, set }) => {
      set.headers['X-Request-Id'] = randomUUID();

      const contentLength = Number(request.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxRequestBodySize) {
        return problem(413, {
          title: 'Payload Too Large',
          detail: 'Request body exceeds the maximum size',
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
        path === '/docs' ||
        path.startsWith('/docs/') ||
        path.startsWith('/api/auth/') ||
        path.startsWith('/openapi/');
      if (!isKnownRoute) {
        return problem(404, {
          title: 'Not Found',
          detail: 'Route not found',
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
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Request-Id',
          'sentry-trace',
          'baggage',
        ],
        exposeHeaders: ['X-Request-Id'],
      }),
    )
    .afterHandle(({ set }) => {
      set.headers['X-Content-Type-Options'] = 'nosniff';
      set.headers['Referrer-Policy'] = 'no-referrer';
      set.headers['X-Frame-Options'] = 'DENY';
      set.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';
    })
    .error(normalizeError)
    .get(
      '/health',
      {
        detail: {
          summary: 'Check API health',
          description: 'Confirms that the API process is responding without checking dependencies.',
          tags: ['Health'],
          responses: {
            200: {
              description: 'The API process is responding.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['status'],
                    properties: {
                      status: { type: 'string', enum: ['ok'] },
                    },
                  },
                },
              },
            },
          },
        },
      },
      () => ({ status: 'ok' }),
    )
    .get(
      '/ready',
      {
        detail: {
          summary: 'Check API readiness',
          description: 'Checks PostgreSQL and Redis and reports each dependency state.',
          tags: ['Health'],
          responses: {
            200: {
              description: 'The API and all dependencies are ready.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['status', 'dependencies'],
                    properties: {
                      status: { type: 'string', enum: ['ready'] },
                      dependencies: {
                        type: 'object',
                        required: ['postgres', 'redis'],
                        properties: {
                          postgres: { type: 'string', enum: ['ok'] },
                          redis: { type: 'string', enum: ['ok'] },
                        },
                      },
                    },
                  },
                },
              },
            },
            503: {
              description: 'The API is responding, but at least one dependency is unavailable.',
              content: {
                'application/problem+json': {
                  schema: {
                    type: 'object',
                    required: ['type', 'title', 'status', 'detail', 'readiness', 'dependencies'],
                    properties: {
                      type: { type: 'string' },
                      title: { type: 'string', enum: ['Service Unavailable'] },
                      status: { type: 'integer', enum: [503] },
                      detail: { type: 'string' },
                      readiness: { type: 'string', enum: ['not_ready'] },
                      dependencies: {
                        type: 'object',
                        required: ['postgres', 'redis'],
                        properties: {
                          postgres: { type: 'string', enum: ['ok', 'down'] },
                          redis: { type: 'string', enum: ['ok', 'down'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async () => {
        const [postgres, redis] = await Promise.all([
          checkDependency(checkDatabase),
          checkDependency(checkRedis),
        ]);
        const dependencies = { postgres: postgres ? 'ok' : 'down', redis: redis ? 'ok' : 'down' };

        if (postgres && redis) {
          return { status: 'ready', dependencies };
        }

        return problem(503, {
          title: 'Service Unavailable',
          detail: 'PostgreSQL and Redis are not ready.',
          readiness: 'not_ready',
          dependencies,
        });
      },
    )
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
        path: '/docs',
        scalar: {
          darkMode: true,
          favicon: 'http://localhost:4200/favicon.ico',
          telemetry: false,
          schemaKeyboardNav: true,
        },
        ...openApiTypeReferences,
      }),
    )
    .mount(auth.handler)
    .macro({
      auth: {
        async derive({ request: { headers } }) {
          const session = await auth.api.getSession({
            headers,
          });

          if (!session) {
            return problem(401, {
              title: 'Unauthorized',
              detail: 'Authentication is required.',
            });
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
export const app = Sentry.withElysia(createApp()).error(normalizeError).listen(3000);

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
