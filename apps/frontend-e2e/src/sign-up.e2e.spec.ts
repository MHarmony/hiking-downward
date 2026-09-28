import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const accessibilityTags = [
  'wcag2aaa',
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
  'experimental',
];

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

/** Opens the magic-link completion page with the callback state from sign-up. */
async function visitSignUpComplete(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'hiking-downward.sign-up-completion-flow',
      JSON.stringify({ expiresAt: Date.now() + 24 * 60 * 60 * 1000, id: 'test-flow' }),
    );
  });
  await page.goto('/sign-up/complete?flow=test-flow');
}

test.describe('sign-up page', () => {
  test('renders password and magic-link registration', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).toHaveTitle('HikingDownward - Sign Up');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a sign-up link' })).toBeVisible();
  });

  test('shows required and password policy errors', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(page.getByText('Enter a password.')).toBeVisible();
    await expect(page.getByText('Confirm your password.')).toBeVisible();
    await expect(page.locator('#email')).toBeFocused();
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Email address').fill('hiker@example.com');
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm password').fill('different');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    await expect(page.getByText('Passwords must match.')).toBeVisible();
  });

  test('normalizes email and shows verification feedback after registration', async ({ page }) => {
    await mockAuthResponse(page, '**/sign-up/email', {
      status: 200,
      body: { token: 'verification-token', user: { id: 'new-user' } },
    });
    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill('  HIKER@EXAMPLE.COM  ');
    await page.getByLabel('Password', { exact: true }).fill('correct horse');
    await page.getByLabel('Confirm password').fill('correct horse');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Check your email. We sent verification instructions to hiker@example.com.',
    );
  });

  test('sends a magic-link registration request', async ({ page }) => {
    await mockAuthResponse(page, '**/sign-in/magic-link', {
      status: 200,
      body: { status: true },
    });
    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill('hiker@example.com');
    await page.getByRole('button', { name: 'Email me a sign-up link' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Check your email. We sent verification instructions to hiker@example.com.',
    );
  });

  test('shows registration server errors', async ({ page }) => {
    await mockAuthResponse(page, '**/sign-up/email', { status: 500, body: {} });
    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill('hiker@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse');
    await page.getByLabel('Confirm password').fill('correct horse');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('status')).toContainText('Unable to create your account.');
  });

  test('has accessible structure and keyboard controls', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const controls = [
      page.getByLabel('Email address'),
      page.getByLabel('Password', { exact: true }),
      page.getByLabel('Confirm password'),
      page.getByRole('button', { name: 'Create account' }),
      page.getByRole('button', { name: 'Email me a sign-up link' }),
      page.getByRole('link', { name: 'Sign in' }),
    ] as const;
    const focusControl = async (control: Locator): Promise<void> => {
      await control.focus();
      await expect(control).toBeFocused();
    };
    await focusControl(controls[0]);
    await focusControl(controls[1]);
    await focusControl(controls[2]);
    await focusControl(controls[3]);
    await focusControl(controls[4]);
    await focusControl(controls[5]);

    const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('renders the magic-link completion page', async ({ page }) => {
    await visitSignUpComplete(page);

    await expect(page).toHaveTitle('HikingDownward - Sign Up Complete');
    await expect(page.getByRole('heading', { name: 'Your sign-up link is ready' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue to HikingDownward' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('shows not-found for direct access to magic-link completion', async ({ page }) => {
    await page.goto('/sign-up/complete');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`sign-up page accessibility in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('has no violations before or after validation', async ({ page }) => {
      await page.goto('/sign-up');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const initialResults = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
      expect(initialResults.violations).toEqual([]);

      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByText('Enter your email address.')).toBeVisible();
      const errorResults = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
      expect(errorResults.violations).toEqual([]);
    });
  });
}
