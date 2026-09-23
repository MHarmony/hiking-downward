import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig } from 'vitest/config';

/** Vitest configuration for the HikingDownward database library. */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/api/database',
  plugins: [viteStaticCopy({ targets: [{ src: 'README.md', dest: '.' }] })],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: '@seahawk/database',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      include: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['src/**/*.schema.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reportsDirectory: '../../../coverage/libs/api/database',
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
