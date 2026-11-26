import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import path from 'node:path';

export type TunerOptions = {
  sourceDirectory?: string;
  exclude?: readonly string[];
};

type TurbopackRules = NonNullable<NonNullable<NextConfig['turbopack']>['rules']>;
type RuleCollection = TurbopackRules[string];
type RuleConfig = Exclude<RuleCollection, readonly unknown[]>;
type RuleItem = Extract<RuleCollection, readonly unknown[]>[number];
type LoaderItem = NonNullable<RuleConfig['loaders']>[number];

type ResolvedOptions = { root: string; sourceDirectory: string; exclude: string[] };

const DEFAULT_SOURCE_DIRECTORY = 'src';
const DEFAULT_PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];
const DEV_EXTENSION_PREFIX = 'dev.';
const SCRIPT_RULE = '*.{ts,tsx,js,jsx}';
const STYLESHEET_RULE = '*.css';
const RAW_STYLESHEET: RuleConfig = { condition: { query: '?raw' }, type: 'text' };
const OPTIONS_VARIABLE = 'TUNER_OPTIONS';
const TUNER_DIRECTORY = import.meta.dirname;
const LOADER_PATH = path.join(TUNER_DIRECTORY, 'transform', 'loader.ts');

export function withTuner(config: NextConfig, options: TunerOptions = {}): (phase: string) => NextConfig {
  return (phase) =>
    phase === PHASE_DEVELOPMENT_SERVER ? withDevelopmentTuner(config, resolveOptions(options)) : config;
}

function withDevelopmentTuner(config: NextConfig, options: ResolvedOptions): NextConfig {
  const pageExtensions = config.pageExtensions ?? DEFAULT_PAGE_EXTENSIONS;
  return {
    ...config,
    pageExtensions: [...pageExtensions, ...pageExtensions.map((extension) => `${DEV_EXTENSION_PREFIX}${extension}`)],
    env: { ...config.env, [OPTIONS_VARIABLE]: JSON.stringify(options) },
    turbopack: {
      ...config.turbopack,
      rules: developmentRules(config.turbopack?.rules ?? {}, options),
    },
  };
}

function developmentRules(rules: TurbopackRules, options: ResolvedOptions): TurbopackRules {
  return appendRule(appendRule(rules, SCRIPT_RULE, scriptRule(options)), STYLESHEET_RULE, RAW_STYLESHEET);
}

function resolveOptions(options: TunerOptions): ResolvedOptions {
  const root = process.cwd();
  return {
    root,
    sourceDirectory: options.sourceDirectory ?? DEFAULT_SOURCE_DIRECTORY,
    exclude: [...(options.exclude ?? []), projectPath(root, TUNER_DIRECTORY)],
  };
}

function scriptRule(options: ResolvedOptions): RuleConfig {
  return {
    condition: {
      all: [
        'browser',
        'development',
        { not: 'foreign' },
        { path: projectGlob(options.root, path.resolve(options.root, options.sourceDirectory)) },
        { not: { path: projectGlob(options.root, TUNER_DIRECTORY) } },
      ],
    },
    loaders: [{ loader: LOADER_PATH, options }],
  };
}

function appendRule(rules: TurbopackRules, glob: string, rule: RuleConfig): TurbopackRules {
  const existing = rules[glob];
  return { ...rules, [glob]: existing === undefined ? rule : [...ruleList(existing), rule] };
}

function ruleList(collection: RuleCollection): RuleItem[] {
  if (!Array.isArray(collection)) return [collection];
  return collection.every(isLoaderItem) ? [{ loaders: collection }] : collection;
}

function isLoaderItem(item: RuleItem): item is LoaderItem {
  return typeof item === 'string' || 'loader' in item;
}

function projectGlob(root: string, directory: string): string {
  const relative = projectPath(root, directory);
  return relative === '' ? './**' : `./${relative}/**`;
}

function projectPath(root: string, directory: string): string {
  return path.relative(root, directory).split(path.sep).join('/');
}
