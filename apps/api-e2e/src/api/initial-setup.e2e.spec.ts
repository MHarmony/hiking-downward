import { expect, test } from '@playwright/test';

test.describe('initial API setup', () => {
  test('reports health on startup', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  test('reports dependency readiness on startup', async ({ request }) => {
    const response = await request.get('/ready');
    const body = await response.json();

    expect([200, 503]).toContain(response.status());
    expect(body).toMatchObject(
      response.status() === 200
        ? {
            status: 'ready',
            dependencies: {
              postgres: expect.stringMatching(/^(ok|down)$/),
              redis: expect.stringMatching(/^(ok|down)$/),
            },
          }
        : {
            status: 503,
            title: 'Service Unavailable',
            readiness: 'not_ready',
            dependencies: {
              postgres: expect.stringMatching(/^(ok|down)$/),
              redis: expect.stringMatching(/^(ok|down)$/),
            },
          },
    );
  });

  test('serves the OpenAPI document on startup', async ({ request }) => {
    const response = await request.get('/openapi/json');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toMatchObject({
      info: {
        title: 'HikingDownward API',
        version: '0.0.0',
      },
    });
  });
});
