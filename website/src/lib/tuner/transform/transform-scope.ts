import path from 'node:path';

export type TransformOptions = {
  file: string;
  root: string;
  sourceDirectory: string;
  exclude?: readonly string[];
};

export type TransformScope = {
  readonly root: string;
  isAppFile(file: string): boolean;
  relative(file: string): string;
};

const TUNER_DIRECTORY = path.resolve(import.meta.dirname, '..');
const SCRIPT_FILE = /\.(?:[cm]?[jt]sx?)$/;

export const TUNABLE_FILE = path.join(TUNER_DIRECTORY, 'tunable.ts');
export const RUNTIME_ENTRY = path.join(TUNER_DIRECTORY, 'runtime', 'entry');

export function createScope(options: TransformOptions): TransformScope {
  const sourceDirectory = path.resolve(options.root, options.sourceDirectory);
  const excluded = (options.exclude ?? []).map((directory) => path.resolve(options.root, directory));
  return {
    root: options.root,
    isAppFile: (file) =>
      SCRIPT_FILE.test(file) &&
      isInside(file, sourceDirectory) &&
      !excluded.some((directory) => isInside(file, directory)) &&
      !file.split(path.sep).includes('node_modules'),
    relative: (file) => toPosix(path.relative(options.root, file)),
  };
}

export function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

function isInside(file: string, directory: string): boolean {
  const relative = path.relative(directory, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
