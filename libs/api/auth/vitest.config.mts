import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig } from 'vitest/config';

/** Vitest configuration for the HikingDownward auth library. */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/api/auth',
  plugins: [viteStaticCopy({ targets: [{ src: 'README.md', dest: '.' }] })],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: '@hiking-downward/api-auth',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      include: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reportsDirectory: '../../../coverage/libs/api/auth',
      provider: 'v8' as const,
      enabled: true,
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
}));
