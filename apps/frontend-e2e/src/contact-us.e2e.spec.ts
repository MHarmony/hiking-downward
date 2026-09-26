import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('contact page', () => {
  test('contact route renders support information', async ({ page }) => {
    await page.goto('/contact');

    await expect(page.getByRole('heading', { name: 'Contact support' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'General support' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bug reports' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Email support' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report a bug' })).toBeVisible();
    await expect(page).toHaveTitle('HikingDownward - Contact Us');
    await expect(page.getByText('Have a question or need assistance?')).toBeVisible();
  });

  test('contact page has no automated accessibility violations', async ({ page }) => {
    await page.goto('/contact');

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

  test('contact page has an accessible document structure', async ({ page }) => {
    await page.goto('/contact');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Email support' })).toHaveAttribute(
      'href',
      'mailto:contact@hikingdownward.com',
    );
    await expect(page.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
      'href',
      'https://github.com/MHarmony/hiking-downward/issues',
    );
  });

  test('contact page links are keyboard accessible and have visible focus', async ({ page }) => {
    await page.goto('/contact');

    const emailLink = page.getByRole('link', { name: 'Email support' });
    const bugLink = page.getByRole('link', { name: 'Report a bug' });

    await emailLink.focus();
    await expect(emailLink).toBeFocused();
    await expect(emailLink).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(bugLink).toBeFocused();
    await expect(bugLink).toBeVisible();
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await expect(page.locator(':focus-visible')).toContainText('Report a bug');
  });
});

test.describe('contact page in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('has no automated accessibility violations', async ({ page }) => {
    await page.goto('/contact');

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

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`contact page hover states in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const name of ['Email support', 'Report a bug']) {
      test(`${name} has no accessibility violations while hovered`, async ({ page }) => {
        await page.goto('/contact');

        await page.getByRole('link', { name }).hover();

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
    }
  });
}
