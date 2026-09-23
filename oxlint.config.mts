import playwright from 'eslint-plugin-playwright';
import { defineConfig } from 'oxlint';

/** Oxc lint configuration for the HikingDownward workspace. */
export default defineConfig({
  categories: {
    correctness: 'error',
    perf: 'error',
    restriction: 'error',
  },
  env: {
    builtin: true,
  },
  jsPlugins: [
    'eslint-plugin-playwright',
    'eslint-plugin-tailwindcss',
    'eslint-plugin-drizzle',
    '@nx/oxlint/boundaries-plugin',
  ],
  options: {
    reportUnusedDisableDirectives: 'error',
    respectEslintDisableDirectives: false,
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.mts'],
      rules: {
        'max-lines': ['error', 500],
        'no-async-await': 'off',
        'oxc/no-rest-spread-properties': 'off',
        '@nx/enforce-module-boundaries': [
          'error',
          {
            depConstraints: [
              {
                sourceTag: 'type:ui',
                onlyDependOnLibsWithTags: ['type:util', 'type:ui'],
              },
              {
                sourceTag: 'type:util',
                onlyDependOnLibsWithTags: ['type:util'],
              },
              {
                sourceTag: 'type:feature',
                onlyDependOnLibsWithTags: [
                  'type:util',
                  'type:ui',
                  'type:data-access',
                  'type:feature',
                ],
              },
              {
                sourceTag: 'type:data-access',
                onlyDependOnLibsWithTags: ['type:util', 'type:data-access'],
              },
              {
                sourceTag: 'scope:frontend',
                onlyDependOnLibsWithTags: ['scope:shared', 'scope:frontend'],
              },
              {
                sourceTag: 'scope:api',
                onlyDependOnLibsWithTags: ['scope:shared', 'scope:api'],
              },
              {
                sourceTag: 'scope:shared',
                onlyDependOnLibsWithTags: ['scope:shared'],
              },
            ],
          },
        ],
      },
    },
    {
      files: ['**/*.css'],
      rules: {
        'tailwindcss/classnames-order': 'error',
        'tailwindcss/no-custom-classname': 'error',
        'tailwindcss/enforces-negative-arbitrary-values': 'error',
        'tailwindcss/enforces-shorthand': 'error',
        'tailwindcss/no-unnecessary-arbitrary-value': 'error',
        'tailwindcss/no-contradicting-classname': 'error',
        'tailwindcss/important-modifier-suffix': 'error',
        'tailwindcss/enforces-canonical-classname': 'error',
      },
    },
    {
      files: ['**/*.e2e.spec.ts'],
      rules: { ...playwright.configs['flat/recommended'].rules },
    },
    {
      files: ['**/*.schema.ts'],
      rules: {
        'drizzle/enforce-delete-with-where': 'error',
        'drizzle/enforce-update-with-where': 'error',
      },
    },
    {
      env: {
        vitest: true,
      },
      files: ['**/*.spec.ts'],
      rules: {
        'max-lines': 'off',
      },
    },
  ],
  plugins: ['typescript', 'eslint', 'vitest', 'jsdoc', 'unicorn', 'oxc'],
  settings: {
    tailwindcss: {
      cssConfigPath: 'apps/frontend/src/styles.css',
    },
  },
});
