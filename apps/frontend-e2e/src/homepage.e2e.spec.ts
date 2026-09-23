import { expect, test } from '@playwright/test';

test('homepage title is HikingDownward', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('HikingDownward - 404'); // Change this later once we actually have a homepage
});
