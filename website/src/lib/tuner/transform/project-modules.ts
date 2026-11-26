import type * as t from '@babel/types';
import { createImportResolver } from './module-resolver.ts';
import { parseModule } from './parse-module.ts';
import fs from 'node:fs';

export type ProjectModules = {
  resolve(specifier: string, importer: string): string | null;
  read(file: string): t.Program | null;
};

export function createProjectModules(root: string, dependencies: Set<string>): ProjectModules {
  const programs = new Map<string, t.Program | null>();
  return {
    resolve: createImportResolver(root, dependencies),
    read(file) {
      if (!programs.has(file)) programs.set(file, readProgram(file, dependencies));
      return programs.get(file) ?? null;
    },
  };
}

function readProgram(file: string, dependencies: Set<string>): t.Program | null {
  const source = readSource(file);
  if (source === null) return null;
  dependencies.add(file);
  return parseModule(source, file)?.program ?? null;
}

function readSource(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
