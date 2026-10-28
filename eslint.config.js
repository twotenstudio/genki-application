import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', '.astro/', 'playwright-report/', 'test-results/']),
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs['flat/recommended'],
  astro.configs['flat/jsx-a11y-strict'],
  {
    files: ['**/*.tsx'],
    extends: [jsxA11y.configs.strict, reactHooks.configs.flat['recommended-latest']],
    rules: {
      // The ARIA tabs pattern puts tabindex="0" on a tab panel whose first content isn't focusable.
      'jsx-a11y-x/no-noninteractive-tabindex': ['error', { roles: ['tabpanel'], tags: [] }],
    },
  },
  {
    // Inlined into <head> as a classic script, so it only sees browser globals.
    files: ['src/scripts/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        localStorage: 'readonly',
        matchMedia: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
);
