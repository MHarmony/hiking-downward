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

test.describe('reset-password page', () => {
  test('explains a missing or expired token and offers a fresh reset link', async ({ page }) => {
    await page.goto('/reset-password?error=INVALID_TOKEN');

    await expect(page).toHaveTitle('HikingDownward - Reset Password');
    await expect(
      page.getByText('This password reset link is invalid or has expired.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    await expect(page.locator('form')).toHaveCount(0);
  });

  test('validates new password and confirmation', async ({ page }) => {
    await page.goto('/reset-password?token=valid-reset-token');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText('Enter a new password.')).toBeVisible();
    await expect(page.getByText('Confirm your new password.')).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused();

    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Confirm new password').fill('different');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    await expect(page.getByText('Passwords must match.')).toBeVisible();
  });

  test('resets the password and shows a sign-in link', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/reset-password', async (route) => {
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
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        body: JSON.stringify({ status: true }),
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 200,
      });
    });

    await page.goto('/reset-password?token=valid-reset-token');
    await page.getByLabel('New password', { exact: true }).fill('correct horse');
    await page.getByLabel('Confirm new password').fill('correct horse');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Your password has been reset. Sign in with your new password.',
    );
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(requestBody).toEqual({ newPassword: 'correct horse', token: 'valid-reset-token' });
  });

  test('shows an expired server token error without losing the form', async ({ page }) => {
    await mockAuthResponse(page, '**/reset-password', {
      status: 400,
      body: { code: 'INVALID_TOKEN' },
    });
    await page.goto('/reset-password?token=expired-reset-token');
    await page.getByLabel('New password', { exact: true }).fill('correct horse');
    await page.getByLabel('Confirm new password').fill('correct horse');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByRole('status')).toContainText('Unable to reset your password.');
    await expect(page.locator('form')).toBeVisible();
  });

  test('has no accessibility violations for both link states', async ({ page }) => {
    await page.goto('/reset-password?error=INVALID_TOKEN');
    let results = await new AxeBuilder({ page })
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

    await page.goto('/reset-password?token=valid-reset-token');
    results = await new AxeBuilder({ page })
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
