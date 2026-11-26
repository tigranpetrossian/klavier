import type { NextConfig } from 'next';
import { afterEach, expect, test, vi } from 'vitest';
import { withTuner } from './next';
import path from 'node:path';
import fs from 'node:fs';

type RuleCollection = NonNullable<NonNullable<NextConfig['turbopack']>['rules']>[string];

const REPOSITORY = path.resolve(import.meta.dirname, '../../..');
const TUNER_DIRECTORY = path.join(REPOSITORY, 'src/lib/tuner');
const LOADER_PATH = path.join(TUNER_DIRECTORY, 'transform/loader.ts');
const PROJECT_ROOT = '/projects/site';
const DEVELOPMENT_SERVER = 'phase-development-server';
const TAILWIND_RULE = { loaders: ['@tailwindcss/turbopack'], as: '*.css' };
const RAW_STYLESHEET_RULE = { condition: { query: '?raw' }, type: 'text' };

afterEach(() => {
  vi.restoreAllMocks();
});

test('the development server runs the tuner loader on browser builds of source files, after the existing rules, and excludes the tuner itself', () => {
  vi.spyOn(process, 'cwd').mockReturnValue(REPOSITORY);
  const config: NextConfig = { turbopack: { rules: { '*.css': TAILWIND_RULE } } };

  const tuned = withTuner(config, { exclude: ['src/app/tuner-lab/_panel'] })(DEVELOPMENT_SERVER);

  expect(tuned.turbopack?.rules).toEqual({
    '*.css': [TAILWIND_RULE, RAW_STYLESHEET_RULE],
    '*.{ts,tsx,js,jsx}': {
      condition: {
        all: [
          'browser',
          'development',
          { not: 'foreign' },
          { path: './src/**' },
          { not: { path: './src/lib/tuner/**' } },
        ],
      },
      loaders: [
        {
          loader: LOADER_PATH,
          options: { root: REPOSITORY, sourceDirectory: 'src', exclude: ['src/app/tuner-lab/_panel', 'src/lib/tuner'] },
        },
      ],
    },
  });
});

test('the development server loads stylesheets imported with ?raw as text, after the existing stylesheet rules', () => {
  const configs: NextConfig[] = [{}, { turbopack: { rules: { '*.css': TAILWIND_RULE } } }];

  const rules = configs.map((config) => withTuner(config)(DEVELOPMENT_SERVER).turbopack?.rules?.['*.css']);

  expect(rules).toEqual([RAW_STYLESHEET_RULE, [TAILWIND_RULE, RAW_STYLESHEET_RULE]]);
});

test('the loader the rule names is a file that exists', () => {
  const tuned = withTuner({})(DEVELOPMENT_SERVER);
  const rule = tuned.turbopack?.rules?.['*.{ts,tsx,js,jsx}'];
  const loader = rule && !Array.isArray(rule) ? rule.loaders?.[0] : undefined;

  expect(typeof loader === 'object' && fs.existsSync(loader.loader)).toBe(true);
});

test('a source directory option moves the rule to that directory', () => {
  vi.spyOn(process, 'cwd').mockReturnValue(REPOSITORY);

  const tuned = withTuner({}, { sourceDirectory: 'app-src' })(DEVELOPMENT_SERVER);

  expect(tuned.turbopack?.rules?.['*.{ts,tsx,js,jsx}']).toMatchObject({
    condition: {
      all: [
        'browser',
        'development',
        { not: 'foreign' },
        { path: './app-src/**' },
        { not: { path: './src/lib/tuner/**' } },
      ],
    },
  });
});

test.each<[string, RuleCollection, readonly unknown[]]>([
  ['a single rule', { loaders: ['other-loader'] }, [{ loaders: ['other-loader'] }]],
  [
    'a list of rules',
    [{ condition: 'browser', loaders: ['other-loader'] }],
    [{ condition: 'browser', loaders: ['other-loader'] }],
  ],
  ['a list of loaders', ['other-loader'], [{ loaders: ['other-loader'] }]],
])('an existing rule for script files given as %s is kept ahead of the tuner rule', (_form, existing, kept) => {
  const config: NextConfig = { turbopack: { rules: { '*.{ts,tsx,js,jsx}': existing } } };

  const rules = withTuner(config)(DEVELOPMENT_SERVER).turbopack?.rules?.['*.{ts,tsx,js,jsx}'];

  expect(rules).toEqual([
    ...kept,
    expect.objectContaining({ loaders: [expect.objectContaining({ loader: LOADER_PATH })] }),
  ]);
});

test.each([
  [undefined, ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts', 'dev.jsx', 'dev.js']],
  [
    ['tsx', 'mdx'],
    ['tsx', 'mdx', 'dev.tsx', 'dev.mdx'],
  ],
])('page extensions %j gain dev. variants after them', (pageExtensions, expected) => {
  const tuned = withTuner({ pageExtensions })(DEVELOPMENT_SERVER);

  expect(tuned.pageExtensions).toEqual(expected);
});

test('the route handlers get the project root, source directory and excluded directories through TUNER_OPTIONS', () => {
  vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_ROOT);

  const tuned = withTuner(
    { env: { SITE_NAME: 'tigran.io' } },
    { sourceDirectory: 'app-src', exclude: ['app-src/panel'] }
  )(DEVELOPMENT_SERVER);

  expect([tuned.env?.SITE_NAME, JSON.parse(tuned.env?.TUNER_OPTIONS ?? 'null')]).toEqual([
    'tigran.io',
    {
      root: PROJECT_ROOT,
      sourceDirectory: 'app-src',
      exclude: ['app-src/panel', path.relative(PROJECT_ROOT, TUNER_DIRECTORY)],
    },
  ]);
});

test.each(['phase-production-build', 'phase-production-server', 'phase-export', 'phase-test', 'phase-info'])(
  'in %s the config comes back unchanged',
  (phase) => {
    const config: NextConfig = { pageExtensions: ['tsx'], turbopack: { rules: { '*.css': TAILWIND_RULE } } };

    expect(withTuner(config)(phase)).toBe(config);
  }
);
