import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Request } from '@playwright/test';

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

/**
 * Fulfils a cross-origin Better Auth request, answering its CORS preflight first.
 *
 * @param page Browser page whose request is intercepted.
 * @param urlPattern Playwright URL pattern identifying the Better Auth endpoint.
 * @param response Status and JSON body returned to the frontend.
 * @param onRequest Optional callback receiving the non-preflight request.
 * @returns A promise settling after the route is registered.
 * @throws Propagates Playwright route-registration failures.
 */
async function mockAuthResponse(
  page: Page,
  urlPattern: string,
  response: { status: number; body: Record<string, unknown> },
  onRequest?: (request: Request) => void,
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

    if (onRequest) {
      onRequest(route.request());
    }
    await route.fulfill({
      body: JSON.stringify(response.body),
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: response.status,
    });
  });
}

test.describe('sign-in page', () => {
  test('renders the available authentication methods', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page).toHaveTitle('HikingDownward - Sign In');
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    const hikingImage = page.getByAltText('Stick figure hiking toward a mountain');
    await expect(hikingImage).toBeVisible();
    await expect(hikingImage).toHaveAttribute('src', /\/images\/hiker-mountain\.svg/);
    await expect(hikingImage).toHaveAttribute('width', '240');
    await expect(hikingImage).toHaveAttribute('height', '180');
    await expect(page.getByLabel('Email address or username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a magic link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
  });

  test('shows required errors when password sign-in is submitted empty', async ({ page }) => {
    await page.goto('/sign-in');

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText('Enter your email address or username.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await expect(page.locator('#emailOrUsername')).toBeFocused();
    await expect(page.locator('#emailOrUsername')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#emailOrUsername')).toHaveAttribute(
      'aria-describedby',
      'emailOrUsername-error',
    );
    await expect(page.locator('#password')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#password')).toHaveAttribute('aria-describedby', 'password-error');
    await expect(page).toHaveURL(/\/en\/sign-in$/);

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

  test('rejects a username before requesting a magic link', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email address or username').fill('trail_runner');

    let magicLinkRequested = false;
    await page.route('**/sign-in/magic-link', async (route) => {
      magicLinkRequested = true;
      await route.continue();
    });
    await page.getByRole('button', { name: 'Email me a magic link' }).click();

    await expect(page.getByText('Magic link sign-in requires an email address.')).toBeVisible();
    await expect(page.locator('#emailOrUsername')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#emailOrUsername')).toHaveAttribute(
      'aria-describedby',
      'emailOrUsername-error',
    );
    expect(magicLinkRequested).toBe(false);
  });

  test('returns to the requested settings page after password sign-in', async ({ page }) => {
    await mockAuthResponse(page, '**/sign-in/email', {
      status: 200,
      body: {
        token: 'session-token',
        user: { id: 'hiker', email: 'hiker@example.com', name: 'Trail Hiker' },
      },
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
        },
      },
    });
    await page.goto('/sign-in?returnUrl=%2Fsettings%2Fprofile');
    await page.getByLabel('Email address or username').fill('hiker@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page).toHaveURL(/\/en\/settings\/profile$/);
    await expect(page.getByLabel('Display name')).toHaveValue('Trail Hiker');
  });

  test('has an accessible document structure', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('authentication controls are keyboard accessible and have visible focus', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    const emailInput = page.getByLabel('Email address or username');
    const passwordInput = page.getByLabel('Password');
    const forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
    const signInButton = page.getByRole('button', { name: 'Sign in', exact: true });
    const magicLinkButton = page.getByRole('button', { name: 'Email me a magic link' });
    const passkeyButton = page.getByRole('button', { name: 'Sign in with a passkey' });
    const signUpLink = page.getByRole('link', { name: 'Sign up' });

    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();
    await forgotPasswordLink.focus();
    await expect(forgotPasswordLink).toBeFocused();
    await signInButton.focus();
    await expect(signInButton).toBeFocused();
    await magicLinkButton.focus();
    await expect(magicLinkButton).toBeFocused();
    await passkeyButton.focus();
    await expect(passkeyButton).toBeFocused();
    await signUpLink.focus();
    await expect(signUpLink).toBeFocused();
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await expect(page.locator(':focus-visible')).toContainText('Sign up');
  });

  test('exposes passkey conditional UI fields and has no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    await expect(page.locator('#emailOrUsername')).toHaveAttribute(
      'autocomplete',
      'username webauthn',
    );
    await expect(page.locator('#password')).toHaveAttribute(
      'autocomplete',
      'current-password webauthn',
    );

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

test.describe('sign-in page in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('has no accessibility violations before or after validation errors', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const initialResults = await new AxeBuilder({ page })
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

    expect(initialResults.violations).toEqual([]);

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Enter your password.')).toBeVisible();

    const errorResults = await new AxeBuilder({ page })
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

    expect(errorResults.violations).toEqual([]);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`sign-in page auth feedback in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('magic-link confirmation has no accessibility violations', async ({ page }) => {
      let callbackUrl: string | undefined;
      await mockAuthResponse(
        page,
        '**/sign-in/magic-link',
        {
          status: 200,
          body: { status: true },
        },
        (request) => {
          callbackUrl = (request.postDataJSON() as { callbackURL: string }).callbackURL;
        },
      );
      await page.goto('/sign-in?returnUrl=%2Fsettings%2Fsecurity');
      await page.getByLabel('Email address or username').fill('hiker@example.com');
      await page.getByRole('button', { name: 'Email me a magic link' }).click();

      await expect(page.getByRole('status')).toContainText(
        'Check your email. We sent a sign-in link to hiker@example.com.',
      );
      expect(callbackUrl).toBe(`${new URL(page.url()).origin}/en/settings/security`);

      const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();

      expect(results.violations).toEqual([]);
    });

    test('server error message has no accessibility violations', async ({ page }) => {
      await mockAuthResponse(page, '**/sign-in/magic-link', { status: 500, body: {} });
      await page.goto('/sign-in');
      await page.getByLabel('Email address or username').fill('hiker@example.com');
      await page.getByRole('button', { name: 'Email me a magic link' }).click();

      await expect(page.getByRole('status')).toContainText('Unable to send a magic link.');

      const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();

      expect(results.violations).toEqual([]);
    });
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`sign-in page hover states in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    const hoverTargets = [
      { name: 'Forgot password?', role: 'link' },
      { name: 'Sign up', role: 'link' },
      { name: 'Sign in', role: 'button' },
      { name: 'Email me a magic link', role: 'button' },
      { name: 'Sign in with a passkey', role: 'button' },
    ] as const;

    for (const target of hoverTargets) {
      test(`${target.name} has no accessibility violations while hovered`, async ({ page }) => {
        await page.goto('/sign-in');

        await page.getByRole(target.role, { name: target.name, exact: true }).hover();

        const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();

        expect(results.violations).toEqual([]);
      });
    }
  });
}
