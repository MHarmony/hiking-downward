import nxPlugin from '@nx/eslint-plugin';
import * as jsoncParser from 'jsonc-eslint-parser';

/** ESLint configuration for Nx package dependency checks. */
export default [
  {
    files: [
      'libs/api/**/*/package.json',
      'libs/frontend/**/*/package.json',
      'libs/shared/**/*/package.json',
    ],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      '@nx': nxPlugin,
    },
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build'],
          checkMissingDependencies: true,
          checkObsoleteDependencies: true,
          ignoredFiles: [
            '{projectRoot}/**/*.spec.ts',
            '{projectRoot}/vitest.config.*',
            '{projectRoot}/drizzle.config.*',
            '{workspaceRoot}/vitest.config.*',
          ],
        },
      ],
    },
  },
];
