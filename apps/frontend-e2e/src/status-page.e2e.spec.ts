import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const statusPages = [
  { path: '/401', code: '401', heading: 'Unauthorized' },
  { path: '/403', code: '403', heading: 'Forbidden' },
  { path: '/this-route-does-not-exist', code: '404', heading: 'Page not found' },
];

test.describe('status pages', () => {
  for (const statusPage of statusPages) {
    test(`${statusPage.code} route renders its status page`, async ({ page }) => {
      await page.goto(statusPage.path);

      await expect(page.getByRole('heading', { name: statusPage.heading })).toBeVisible();
      await expect(page).toHaveTitle(`HikingDownward - ${statusPage.code}`);
    });

    test(`${statusPage.code} page has no automated accessibility violations`, async ({ page }) => {
      await page.goto(statusPage.path);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag22aa', 'best-practice', 'experimental'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${statusPage.code} ${colorScheme} theme meets WCAG AAA contrast thresholds`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(statusPage.path);

        const results = await new AxeBuilder({ page })
          .withRules(['color-contrast-enhanced'])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }

    test(`${statusPage.code} page has an accessible document structure`, async ({ page }) => {
      await page.goto(statusPage.path);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Go back home' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Contact support' })).toBeVisible();
    });
  }

  test('status page links are keyboard accessible and have visible focus', async ({ page }) => {
    await page.goto('/403');

    const homeLink = page.getByRole('link', { name: 'Go back home' });
    const contactLink = page.getByRole('link', { name: 'Contact support' });

    await homeLink.focus();
    await expect(homeLink).toBeFocused();
    await expect(homeLink).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(contactLink).toBeFocused();
    await expect(contactLink).toBeVisible();
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await expect(page.locator(':focus-visible')).toContainText('Contact support');
  });

  test('the 404 page links back home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.getByRole('link', { name: 'Go back home' }).click();

    await expect(page).toHaveURL('/');
  });
});
