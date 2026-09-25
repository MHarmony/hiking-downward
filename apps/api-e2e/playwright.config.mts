import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig } from '@playwright/test';

/** Base URL used by API end-to-end tests. */
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';
const healthURL = new URL('/health', baseURL).toString();

/** Playwright configuration for the HikingDownward API end-to-end tests. */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  workers: 2,
  use: {
    baseURL,
    trace: 'on-first-retry' as const,
  },
  webServer: {
    command: 'bun nx run @hiking-downward/api:serve:e2e',
    url: healthURL,
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: '@hiking-downward/api',
    },
  ],
});
