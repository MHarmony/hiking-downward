import { expect, test } from '@playwright/test';

test.describe('API behavior', () => {
  test('returns an empty session for an unauthenticated client', async ({ request }) => {
    const response = await request.get('/api/auth/get-session');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toBeNull();
  });

  test('allows the configured frontend origin through CORS', async ({ request }) => {
    const response = await request.fetch('/health', {
      headers: {
        Origin: 'http://localhost:4200',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(response.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('returns request IDs and baseline security headers', async ({ request }) => {
    const response = await request.get('/health');
    const headers = response.headers();

    expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-frame-options']).toBe('DENY');
  });

  test('returns not found for an unknown route', async ({ request }) => {
    const response = await request.get('/does-not-exist');

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      status: 404,
      title: 'Not Found',
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
    expect(response.headers()['x-request-id']).toBeTruthy();
  });

  test('rejects request bodies larger than one mebibyte', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in/email', {
      data: JSON.stringify({ email: 'person@example.com', password: 'x'.repeat(1_048_577) }),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status()).toBe(413);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      status: 413,
      title: 'Payload Too Large',
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
  });
});
