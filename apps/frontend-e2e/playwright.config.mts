import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

/** Base URL used by frontend end-to-end tests. */
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/** Playwright configuration for the HikingDownward frontend end-to-end tests. */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  reporter: [['list'], ['html', { open: 'never' }]],
  workers: 2,
  use: {
    baseURL,
    trace: 'on-first-retry' as const,
  },
  webServer: {
    command: 'bun nx run @hiking-downward/frontend:serve-static',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    cwd: workspaceRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],
});
