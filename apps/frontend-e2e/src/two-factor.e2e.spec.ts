import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Fulfils a cross-origin Better Auth request, answering its CORS preflight first. */
async function mockAuthResponse(
  page: Page,
  urlPattern: string,
  response: { status: number; body: Record<string, unknown> },
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    const corsHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
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

test.describe('two-factor page', () => {
  test('renders authenticator verification and an alternate backup-code method', async ({
    page,
  }) => {
    await page.goto('/two-factor');

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
    await page.goto('/two-factor');
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
    await page.goto('/two-factor');
    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Welcome to HikingDownward' })).toBeVisible();
  });

  test('shows server errors without leaving the challenge', async ({ page }) => {
    await mockAuthResponse(page, '**/two-factor/verify-totp', { status: 401, body: {} });
    await page.goto('/two-factor');
    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByRole('status')).toContainText('Unable to verify your code.');
    await expect(page).toHaveURL('/two-factor');
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/two-factor');
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
});
