import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist', 'website/.next', 'website/out', 'website/next-env.d.ts']),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'import-x/no-default-export': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-relative-packages': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/exports-last': 'error',
      'import-x/order': ['error', { groups: ['external', 'internal', 'parent', 'sibling', 'index'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: 'props|context|event' }],
    },
  },
  {
    files: ['packages/*/src/**', 'website/src/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
    rules: { 'import-x/no-default-export': 'off' },
  },
  {
    files: ['packages/*/smoke/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['website/**'],
    extends: [nextPlugin.configs['core-web-vitals'], reactRefresh.configs.next],
    settings: { next: { rootDir: 'website/' } },
  },
  {
    files: ['website/src/app/**/{page,layout}.tsx'],
    rules: { 'import-x/no-default-export': 'off' },
  },
  {
    files: ['website/src/lib/tuner/**', 'website/src/dev-tools/**'],
    rules: {
      'import-x/exports-last': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'website/src/lib/tuner/transform/loader.ts',
      'website/src/lib/tuner/**/*.d.ts',
      'website/src/lib/tuner/browser-tests/**',
    ],
    rules: { 'import-x/no-default-export': 'off' },
  },
  prettier
);
