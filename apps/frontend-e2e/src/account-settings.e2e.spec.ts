import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Axe rule tags required by the account-settings accessibility checks. */
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

/** Better Auth session fixture used to authenticate settings-page browser tests. */
const authenticatedSession = {
  session: {
    id: 'current-session',
    token: 'session-token-not-for-display',
    userId: 'user-id',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:00:00.000Z',
    expiresAt: '2026-10-14T12:00:00.000Z',
  },
  user: {
    id: 'user-id',
    email: 'hiker@example.com',
    emailVerified: true,
    name: 'Trail Hiker',
    username: 'trail_hiker',
    displayUsername: 'Trail Hiker',
    twoFactorEnabled: false,
  },
};

/**
 * Intercepts one Better Auth endpoint with a successful JSON response.
 *
 * @param page Browser page whose auth request is intercepted.
 * @param path Endpoint path suffix to match.
 * @param body JSON payload returned to the frontend.
 * @param method Optional request method filter; defaults to any method.
 * @returns A promise settling after the route is registered.
 * @throws Propagates Playwright route-registration failures.
 */
async function mockAuthResponse(
  page: Page,
  path: string,
  body: unknown,
  method?: 'GET' | 'POST',
): Promise<void> {
  await page.route(`**/${path}`, async (route) => {
    const request = route.request();
    const corsHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': request.headers()['origin'] ?? 'http://localhost:4200',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ headers: corsHeaders, status: 204 });
      return;
    }
    if (method && request.method() !== method) {
      await route.continue();
      return;
    }

    await route.fulfill({
      body: JSON.stringify(body),
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: 200,
    });
  });
}

/**
 * Installs the common session, active-session, and passkey-list responses.
 *
 * @param page Browser page whose auth requests are intercepted.
 * @param session Session response to return; defaults to the authenticated fixture.
 * @returns A promise settling after all request routes are registered.
 * @throws Propagates Playwright route-registration failures.
 */
async function mockSettingsReads(
  page: Page,
  session: unknown = authenticatedSession,
): Promise<void> {
  await mockAuthResponse(page, 'get-session', session, 'GET');
  await mockAuthResponse(page, 'list-sessions', [], 'GET');
  await mockAuthResponse(page, 'passkey/list-user-passkeys', [], 'GET');
}

const settingsRoutes = [
  { path: '/settings/profile', name: 'Profile' },
  { path: '/settings/security', name: 'Security' },
  { path: '/settings/account', name: 'Account' },
] as const;

const settingsHoverTargets = [
  { path: '/settings/profile', role: 'link', name: 'Profile' },
  { path: '/settings/security', role: 'link', name: 'Security' },
  { path: '/settings/account', role: 'link', name: 'Account' },
  { path: '/settings/profile', role: 'button', name: 'Save profile' },
  { path: '/settings/security', role: 'button', name: 'Change email' },
  { path: '/settings/account', role: 'button', name: 'Send deletion confirmation' },
] as const;

test.describe('account settings', () => {
  test('redirects signed-out users with their requested section preserved', async ({ page }) => {
    await mockSettingsReads(page, null);
    await page.goto('/settings/security');

    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fsettings%2Fsecurity$/);
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  });

  test('loads and saves a profile with accessible feedback', async ({ page }) => {
    await mockSettingsReads(page);
    let updatePayload: Record<string, unknown> | undefined;
    await page.route('**/update-user', async (route) => {
      const request = route.request();
      const corsHeaders = {
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-origin': request.headers()['origin'] ?? 'http://localhost:4200',
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ headers: corsHeaders, status: 204 });
        return;
      }
      updatePayload = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        body: JSON.stringify({ status: true }),
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 200,
      });
    });

    await page.goto('/settings/profile');
    await expect(page).toHaveTitle('HikingDownward - Profile Settings');
    await expect(page.getByLabel('Display name')).toHaveValue('Trail Hiker');
    await page.getByLabel('Display name').fill('Ridge Walker');
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect(page.getByRole('status')).toContainText('Profile saved.');
    expect(updatePayload).toEqual({
      name: 'Ridge Walker',
      username: 'trail_hiker',
      displayUsername: 'Trail Hiker',
    });
    const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('requests an email change and clearly reports where confirmation was sent', async ({
    page,
  }) => {
    await mockSettingsReads(page);
    await mockAuthResponse(page, 'change-email', { status: true }, 'POST');
    await page.goto('/settings/security');
    await page.getByLabel('New email address').fill('new@example.com');
    await page.getByRole('button', { name: 'Change email' }).click();

    await expect(page.getByRole('status')).toContainText('hiker@example.com');
    await expect(page.getByText('Check your current inbox to approve the change')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('verifies authenticator enrollment before revealing backup codes', async ({ page }) => {
    await mockSettingsReads(page);
    await mockAuthResponse(
      page,
      'two-factor/enable',
      {
        method: 'totp',
        totpURI: 'otpauth://totp/HikingDownward?secret=E2ESECRET&issuer=HikingDownward',
        backupCodes: ['ONE-TIME-ONE', 'ONE-TIME-TWO'],
      },
      'POST',
    );
    await mockAuthResponse(page, 'two-factor/verify-totp', { status: true }, 'POST');

    await page.goto('/settings/security');
    await page.getByLabel('Current password').last().fill('current-password');
    await page.getByRole('button', { name: 'Set up authenticator app' }).click();
    await expect(page.getByAltText('Authenticator app setup QR code')).toBeVisible();
    await expect(page.getByText('ONE-TIME-ONE')).toHaveCount(0);
    const setupResults = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
    expect(setupResults.violations).toEqual([]);

    await page.getByLabel('Authenticator code').fill('123456');
    await page.getByRole('button', { name: 'Verify and enable' }).click();

    await expect(page.getByText('Two-factor authentication is enabled.')).toBeVisible();
    await expect(page.getByText('ONE-TIME-ONE')).toBeVisible();
    const backupCodeResults = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
    expect(backupCodeResults.violations).toEqual([]);
  });

  test('requests deletion only after explicit confirmation and exposes a public completion page', async ({
    page,
  }) => {
    await mockSettingsReads(page);
    await mockAuthResponse(
      page,
      'delete-user',
      { success: true, message: 'Verification email sent' },
      'POST',
    );
    await page.goto('/settings/account');
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Send deletion confirmation' }).click();

    await expect(page.getByRole('status')).toContainText('hiker@example.com');
    const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
    expect(results.violations).toEqual([]);

    await page.goto('/account-deleted');
    await expect(page.getByRole('heading', { name: 'Account deleted' })).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`account settings accessibility in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const settingsRoute of settingsRoutes) {
      test(`${settingsRoute.name} page has accessible structure and no Axe violations`, async ({
        page,
      }) => {
        await mockSettingsReads(page);
        await page.goto(settingsRoute.path);

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(
          page.getByRole('navigation', { name: 'Account settings sections' }),
        ).toBeVisible();

        const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
        expect(results.violations).toEqual([]);
      });
    }

    test('settings navigation and profile form have visible keyboard focus', async ({ page }) => {
      await mockSettingsReads(page);
      await page.goto('/settings/profile');

      const profileLink = page.getByRole('link', { name: 'Profile', exact: true });
      const securityLink = page.getByRole('link', { name: 'Security', exact: true });
      const accountLink = page.getByRole('link', { name: 'Account', exact: true });
      await profileLink.focus();
      await page.keyboard.press('Tab');
      await expect(securityLink).toBeFocused();
      await expect(page.locator(':focus-visible')).toContainText('Security');
      await page.keyboard.press('Tab');
      await expect(accountLink).toBeFocused();
      await expect(page.locator(':focus-visible')).toContainText('Account');

      const displayName = page.getByLabel('Display name');
      const username = page.locator('#username');
      const publicUsername = page.locator('#public-username');
      const saveButton = page.getByRole('button', { name: 'Save profile' });
      await displayName.focus();
      await page.keyboard.press('Tab');
      await expect(username).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(publicUsername).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(saveButton).toBeFocused();
      await expect(page.locator(':focus-visible')).toContainText('Save profile');
    });

    for (const hoverTarget of settingsHoverTargets) {
      test(`${hoverTarget.name} has no Axe violations while hovered`, async ({ page }) => {
        await mockSettingsReads(page);
        await page.goto(hoverTarget.path);
        await page.getByRole(hoverTarget.role, { name: hoverTarget.name, exact: true }).hover();

        const results = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}
