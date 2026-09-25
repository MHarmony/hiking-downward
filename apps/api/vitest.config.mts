import { defineConfig } from 'vitest/config';

/** Vitest configuration for the HikingDownward API application. */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: '@hiking-downward/api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      include: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reportsDirectory: '../../coverage/apps/api',
      provider: 'v8' as const,
      enabled: true,
      thresholds: {
        functions: 100,
        branches: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
}));
