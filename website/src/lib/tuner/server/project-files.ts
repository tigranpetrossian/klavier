import type { TunerServerOptions } from './tuner-options.ts';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const STYLESHEET_EXTENSION = '.css';

export type ProjectFile = { file: string; text: string };

export type StylesheetsResult = { ok: true; stylesheets: readonly ProjectFile[] } | { ok: false; reason: string };

export async function readStylesheets(options: TunerServerOptions): Promise<StylesheetsResult> {
  const sourceRoot = path.resolve(options.root, options.sourceDirectory);
  const entries = await listFiles(sourceRoot);
  if (entries === null) {
    return {
      ok: false,
      reason: `Cannot read the source directory ${sourceRoot}`,
    };
  }
  const skipped = options.exclude.map((directory) => path.resolve(options.root, directory));
  const files = entries
    .filter((file) => file.endsWith(STYLESHEET_EXTENSION))
    .filter((file) => !skipped.some((directory) => isInside(directory, file)))
    .sort();
  const read = await Promise.all(files.map((file) => readProjectFile(options.root, file)));
  return { ok: true, stylesheets: read.filter((file) => file !== null) };
}

export async function realSourceDirectory(options: TunerServerOptions): Promise<string | null> {
  return realPath(path.resolve(options.root, options.sourceDirectory));
}

export async function resolveSourceFile(sourceDirectory: string, root: string, file: string): Promise<string | null> {
  const real = await realPath(path.resolve(root, file));
  return real !== null && isInside(sourceDirectory, real) ? real : null;
}

export async function readText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function writeAtomically(file: string, text: string): Promise<boolean> {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, text, { flag: 'wx' });
    await fs.rename(temporary, file);
    return true;
  } catch {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    return false;
  }
}

function isInside(directory: string, file: string): boolean {
  const relative = path.relative(directory, file);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function listFiles(directory: string): Promise<readonly string[] | null> {
  try {
    const entries = await fs.readdir(directory, {
      recursive: true,
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
  } catch {
    return null;
  }
}

async function readProjectFile(root: string, file: string): Promise<ProjectFile | null> {
  try {
    return {
      file: toProjectPath(root, file),
      text: await fs.readFile(file, 'utf8'),
    };
  } catch {
    return null;
  }
}

async function realPath(file: string): Promise<string | null> {
  try {
    return await fs.realpath(file);
  } catch {
    return null;
  }
}

function toProjectPath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}
