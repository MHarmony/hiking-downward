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

test.describe('verify-email result page', () => {
  test('confirms a successful email verification', async ({ page }) => {
    await page.goto('/verify-email/result');

    await expect(page).toHaveTitle('HikingDownward - Verify Email');
    await expect(page.getByRole('heading', { name: 'Your email is verified' })).toBeVisible();
    await expect(page.getByText('Thanks for confirming your email address.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue to HikingDownward' })).toHaveAttribute(
      'href',
      '/',
    );
    await expect(page.locator('form')).toHaveCount(0);
  });

  test('explains an expired link and validates a resend email', async ({ page }) => {
    await page.goto('/verify-email/result?error=TOKEN_EXPIRED');

    await expect(page.getByText('This verification link has expired.')).toBeVisible();
    await page.getByRole('button', { name: 'Send a new verification link' }).click();
    const email = page.getByLabel('Email address');
    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(email).toBeFocused();

    await email.fill('invalid-email');
    await page.getByRole('button', { name: 'Send a new verification link' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  });

  test('resends a verification link to the supplied address', async ({ page }) => {
    await mockAuthResponse(page, '**/send-verification-email', {
      status: 200,
      body: { status: true },
    });
    await page.goto('/verify-email/result?error=INVALID_TOKEN');
    await page.getByLabel('Email address').fill('hiker@example.com');
    await page.getByRole('button', { name: 'Send a new verification link' }).click();

    await expect(page.getByRole('status')).toContainText(
      'If hiker@example.com needs verification, we sent it a new link.',
    );
  });

  test('has no accessibility violations for both result states', async ({ page }) => {
    const tags = [
      'wcag2aaa',
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
      'best-practice',
      'experimental',
    ];
    await page.goto('/verify-email/result');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    let results = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(results.violations).toEqual([]);

    await page.goto('/verify-email/result?error=TOKEN_EXPIRED');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(results.violations).toEqual([]);
  });
});
