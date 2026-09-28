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

test.describe('forgot-password page', () => {
  test('renders the reset request form', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page).toHaveTitle('HikingDownward - Forgot Password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  test('validates an email address before making a request', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    const email = page.getByLabel('Email address');
    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  });

  test('requests a reset link with the reset page as callback', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/request-password-reset', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          headers: {
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': 'content-type',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
          },
          status: 204,
        });
        return;
      }
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        body: JSON.stringify({ status: true, message: 'If this email exists, check your email' }),
        headers: {
          'access-control-allow-credentials': 'true',
          'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
          'content-type': 'application/json',
        },
        status: 200,
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill('  HIKER@EXAMPLE.COM  ');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByRole('status')).toContainText(
      'If an account exists for hiker@example.com, we sent it a password reset link.',
    );
    expect(requestBody).toEqual({
      email: 'hiker@example.com',
      redirectTo: 'http://localhost:4200/reset-password',
    });
  });

  test('shows the same confirmation language for any submitted address', async ({ page }) => {
    await mockAuthResponse(page, '**/request-password-reset', {
      status: 200,
      body: { status: true, message: 'If this email exists, check your email' },
    });
    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill('unknown@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByRole('status')).toContainText(
      'If an account exists for unknown@example.com, we sent it a password reset link.',
    );
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeVisible();
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
