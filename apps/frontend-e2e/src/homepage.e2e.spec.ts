import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('homepage', () => {
  test('renders the signed-out welcome and auth links', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('HikingDownward');
    await expect(page.getByRole('heading', { name: 'Welcome to HikingDownward' })).toBeVisible();
    await expect(page.getByAltText('Stick figure hiking toward a mountain')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/en/sign-in',
    );
    await expect(page.getByRole('link', { name: /Create an account/ })).toHaveAttribute(
      'href',
      '/en/sign-up',
    );
    await expect(page.getByRole('navigation', { name: 'Language' })).toBeVisible();
  });

  test('has an accessible main landmark and one page heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
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

test.describe('Spanish browser preference', () => {
  test.use({ locale: 'es-ES' });

  test('redirects to and renders the Spanish locale', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/es\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(
      page.getByRole('heading', { name: 'Te damos la bienvenida a HikingDownward' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inglés' })).toHaveAttribute('href', '/en/');
  });
});
