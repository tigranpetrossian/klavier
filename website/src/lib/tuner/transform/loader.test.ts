import { afterEach, expect, test } from 'vitest';
import tunerLoader from './loader';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type LoaderRun = { error: Error | null; code: string | undefined; map: unknown; dependencies: string[] };

const REPOSITORY = path.resolve(import.meta.dirname, '../../../..');
const INPUT_MAP = { version: 3, sources: ['input.ts'], names: [], mappings: '' };
const TUNED_SOURCE = "import { tunable } from '@/lib/tuner/tunable';\n\nexport const LIMIT = tunable('limit', 3);\n";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('a module with nothing to tune comes back untouched, with its input map', async () => {
  const root = await createProject({});
  const source = 'export function double(value: number) {\n  return value * 2;\n}\n';

  const run = await runLoader(path.join(root, 'src/app/double.ts'), source, {
    root,
    sourceDirectory: 'src',
    exclude: [],
  });

  expect([run.code === source, run.map === INPUT_MAP, run.dependencies]).toEqual([true, true, []]);
});

test.each([
  ["a 'use server' file", 'src/app/actions.ts', `'use server';\n\n${TUNED_SOURCE}`, {}],
  ['a third-party file', 'node_modules/widget/index.ts', TUNED_SOURCE, { sourceDirectory: '.' }],
  [
    'an excluded directory',
    'src/app/tuner-lab/_panel/panel-config.ts',
    TUNED_SOURCE,
    { exclude: ['src/app/tuner-lab/_panel'] },
  ],
  ['a file outside the source directory', 'scripts/seed.ts', TUNED_SOURCE, {}],
])('%s comes back untouched, with its input map', async (_case, file, source, overrides) => {
  const root = await createProject({});

  const run = await runLoader(path.join(root, file), source, {
    root,
    sourceDirectory: 'src',
    exclude: [],
    ...overrides,
  });

  expect([run.code === source, run.map === INPUT_MAP]).toEqual([true, true]);
});

test('a module with something to tune is transformed and comes with its own source map', async () => {
  const root = await createProject({});
  const file = path.join(root, 'src/app/limits.ts');

  const run = await runLoader(file, TUNED_SOURCE, { root, sourceDirectory: 'src', exclude: [] });

  expect([run.error, run.code === TUNED_SOURCE, run.map]).toEqual([
    null,
    false,
    expect.objectContaining({ sources: [file] }),
  ]);
});

test('a type argument imported through a barrel and a tsconfig path reports every file it was read from', async () => {
  const root = await createProject({
    'src/types/barrel.ts': "export * from './modes';\n",
    'src/types/modes.ts': "export type Mode = 'compact' | 'roomy';\n",
  });
  const source = [
    "import { tunable } from '@/lib/tuner/tunable';",
    "import type { Mode } from '@/types/barrel';",
    "export const MODE = tunable<Mode>('mode', 'compact');",
  ].join('\n');

  const run = await runLoader(path.join(root, 'src/app/mode.ts'), source, {
    root,
    sourceDirectory: 'src',
    exclude: [],
  });

  expect(run.dependencies.toSorted()).toEqual([
    path.join(root, 'src/types/barrel.ts'),
    path.join(root, 'src/types/modes.ts'),
    path.join(root, 'tsconfig.json'),
  ]);
});

test('a constant imported through a barrel reports the barrel and the module that declares it', async () => {
  const root = await createProject({
    'src/config/limits-barrel.ts': "export { LIMIT } from './limits';\n",
    'src/config/limits.ts': 'export const LIMIT = 3;\n',
  });
  const source = "import { LIMIT } from '../config/limits-barrel';\n\nexport const DOUBLE_LIMIT = LIMIT * 2;\n";

  const run = await runLoader(path.join(root, 'src/app/double-limit.ts'), source, {
    root,
    sourceDirectory: 'src',
    exclude: [],
  });

  expect(run.dependencies.toSorted()).toEqual([
    path.join(root, 'src/config/limits-barrel.ts'),
    path.join(root, 'src/config/limits.ts'),
  ]);
});

test('options without a project root fail the module with an error', async () => {
  const root = await createProject({});

  const run = await runLoader(path.join(root, 'src/app/limits.ts'), TUNED_SOURCE, { sourceDirectory: 'src' });

  expect([run.error, run.code]).toEqual([expect.any(Error), undefined]);
});

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tuner-loader-')));
  createdRoots.push(root);
  const tsconfig = {
    compilerOptions: { paths: { '@/lib/tuner/*': [path.join(REPOSITORY, 'src/lib/tuner/*')], '@/*': ['./src/*'] } },
  };
  const entries = { ...files, 'tsconfig.json': JSON.stringify(tsconfig) };
  for (const [file, text] of Object.entries(entries)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }
  return root;
}

function runLoader(resourcePath: string, source: string, options: unknown): Promise<LoaderRun> {
  return new Promise((resolve) => {
    const dependencies: string[] = [];
    const callback = (error: Error | null, code?: string, map?: unknown) => resolve({ error, code, map, dependencies });
    tunerLoader.call(
      {
        resourcePath,
        getOptions: () => options,
        addDependency: (file: string) => dependencies.push(file),
        async: () => callback,
      },
      source,
      INPUT_MAP
    );
  });
}
