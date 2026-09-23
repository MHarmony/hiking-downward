import { defineConfig } from 'vitest/config';

/** Vitest configuration for discovering workspace test configurations. */
export default defineConfig({
  test: {
    projects: [
      '**/vite.config.{mjs,js,ts,mts}',
      '**/vitest.config.{mjs,js,ts,mts}',
      '!vitest.config.{mjs,js,ts,mts}',
      '!vite.config.{mjs,js,ts,mts}',
    ],
  },
});
