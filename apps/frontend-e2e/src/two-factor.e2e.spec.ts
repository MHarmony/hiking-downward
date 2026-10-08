import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Fulfils a cross-origin Better Auth request, answering its CORS preflight first.
 *
 * @param page Browser page whose request is intercepted.
 * @param urlPattern Playwright URL pattern identifying the Better Auth endpoint.
 * @param response Status and JSON body returned to the frontend.
 * @returns A promise settling after the route is registered.
 * @throws Propagates Playwright route-registration failures.
 */
async function mockAuthResponse(
  page: Page,
  urlPattern: string,
  response: { status: number; body: unknown },
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    const corsHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
    };

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ headers: corsHeaders, status: 204 });
      return;
    }

    await route.fulfill({
      body: JSON.stringify(response.body),
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: response.status,
    });
  });
}

/** Opens the challenge page with the pending sign-in state created by Better Auth. */
async function visitTwoFactor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'hiking-downward.two-factor-pending-until',
      String(Date.now() + 10 * 60 * 1000),
    );
  });
  await page.goto('/two-factor');
}

test.describe('two-factor page', () => {
  test('renders authenticator verification and an alternate backup-code method', async ({
    page,
  }) => {
    await visitTwoFactor(page);

    await expect(page).toHaveTitle('HikingDownward - Two-Factor Authentication');
    await expect(page.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible();
    await expect(page.getByLabel('Authentication code')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
    await expect(
      page.getByRole('checkbox', { name: 'Trust this device for 30 days' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify' })).toBeVisible();
    await page.getByRole('button', { name: 'Use a backup code instead' }).click();
    await expect(page.getByLabel('Backup code')).toBeVisible();
  });

  test('requires a six-digit authenticator code and focuses its input', async ({ page }) => {
    await visitTwoFactor(page);
    await page.getByRole('button', { name: 'Verify' }).click();

    const code = page.getByLabel('Authentication code');
    await expect(page.locator('#code-error')).toContainText(
      'Enter the 6-digit code from your authenticator app.',
    );
    await expect(code).toBeFocused();
    await expect(code).toHaveAttribute('aria-invalid', 'true');

    await code.fill('12345');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText('Authenticator codes are 6 digits.')).toBeVisible();
  });

  test('verifies a code and navigates home', async ({ page }) => {
    await mockAuthResponse(page, '**/two-factor/verify-totp', {
      status: 200,
      body: { token: 'session-token', user: { id: 'hiker' } },
    });
    await visitTwoFactor(page);
    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Welcome to HikingDownward' })).toBeVisible();
  });

  test('preserves a settings destination through password and two-factor sign-in', async ({
    page,
  }) => {
    await mockAuthResponse(page, '**/sign-in/email', {
      status: 200,
      body: {
        twoFactorRedirect: true,
        twoFactorToken: 'pending-two-factor-token',
        twoFactorMethods: ['totp'],
      },
    });
    await mockAuthResponse(page, '**/two-factor/verify-totp', {
      status: 200,
      body: { token: 'session-token', user: { id: 'hiker' } },
    });
    await mockAuthResponse(page, '**/get-session', {
      status: 200,
      body: {
        session: {
          id: 'current-session',
          token: 'session-token',
          userId: 'hiker',
          expiresAt: '2026-10-14T12:00:00.000Z',
        },
        user: {
          id: 'hiker',
          email: 'hiker@example.com',
          emailVerified: true,
          name: 'Trail Hiker',
          username: 'trail_hiker',
          displayUsername: 'Trail Hiker',
          twoFactorEnabled: true,
        },
      },
    });
    await mockAuthResponse(page, '**/list-sessions', { status: 200, body: [] });
    await mockAuthResponse(page, '**/passkey/list-user-passkeys', { status: 200, body: [] });

    await page.goto('/sign-in?returnUrl=%2Fsettings%2Fsecurity');
    await page.getByLabel('Email address or username').fill('hiker@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/two-factor$/);

    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page).toHaveURL(/\/settings\/security$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows server errors without leaving the challenge', async ({ page }) => {
    await mockAuthResponse(page, '**/two-factor/verify-totp', { status: 401, body: {} });
    await visitTwoFactor(page);
    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByRole('status')).toContainText('Unable to verify your code.');
    await expect(page).toHaveURL('/two-factor');
  });

  test('has no accessibility violations', async ({ page }) => {
    await visitTwoFactor(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags([
        'wcag2aaa',
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
        'wcag22aa',
        'best-practice',
        'experimental',
      ])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('shows not-found without a pending sign-in challenge', async ({ page }) => {
    await page.goto('/two-factor');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
