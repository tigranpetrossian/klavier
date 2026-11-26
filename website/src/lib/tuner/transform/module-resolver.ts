import fs from 'node:fs';
import path from 'node:path';

type PathAlias = { readonly prefix: string; readonly suffix: string; readonly targets: readonly string[] };

export type ImportResolver = (specifier: string, importer: string) => string | null;

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const JS_EXTENSION = /\.([cm]?)js(x?)$/;
const TSCONFIG = 'tsconfig.json';

export function createImportResolver(root: string, dependencies: Set<string>): ImportResolver {
  let aliases: readonly PathAlias[] | null = null;
  return (specifier, importer) => {
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      return resolveFile(path.resolve(path.dirname(importer), specifier));
    }
    aliases ??= readAliases(root, dependencies);
    return resolveAlias(aliases, specifier);
  };
}

function resolveAlias(aliases: readonly PathAlias[], specifier: string): string | null {
  for (const alias of aliases) {
    const match = matchAlias(alias, specifier);
    if (match === null) continue;
    for (const target of alias.targets) {
      const resolved = resolveFile(target.replace('*', match));
      if (resolved) return resolved;
    }
  }
  return null;
}

function resolveFile(base: string): string | null {
  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => base + extension),
    base.replace(JS_EXTENSION, '.$1ts$2'),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find(isFile) ?? null;
}

function isFile(file: string): boolean {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
}

function matchAlias(alias: PathAlias, specifier: string): string | null {
  const fits =
    specifier.length >= alias.prefix.length + alias.suffix.length &&
    specifier.startsWith(alias.prefix) &&
    specifier.endsWith(alias.suffix);
  return fits ? specifier.slice(alias.prefix.length, specifier.length - alias.suffix.length) : null;
}

function readAliases(root: string, dependencies: Set<string>): readonly PathAlias[] {
  const file = path.join(root, TSCONFIG);
  const text = readText(file);
  if (text === null) return [];
  dependencies.add(file);
  const config = parseJsonc(text);
  const options = isRecord(config) ? config.compilerOptions : undefined;
  if (!isRecord(options) || !isRecord(options.paths)) return [];
  const baseUrl = path.resolve(root, typeof options.baseUrl === 'string' ? options.baseUrl : '.');
  return Object.entries(options.paths)
    .map(([pattern, targets]) => toAlias(pattern, targets, baseUrl))
    .filter((alias) => alias !== null)
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

function toAlias(pattern: string, targets: unknown, baseUrl: string): PathAlias | null {
  if (!Array.isArray(targets)) return null;
  const [prefix, suffix = ''] = pattern.split('*');
  const resolved = targets
    .filter((target) => typeof target === 'string')
    .map((target) => path.resolve(baseUrl, target));
  return { prefix, suffix, targets: resolved };
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function parseJsonc(text: string): unknown {
  try {
    return JSON.parse(stripJsonComments(text));
  } catch {
    return null;
  }
}

function stripJsonComments(text: string): string {
  let output = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      const end = stringEnd(text, index);
      output += text.slice(index, end);
      index = end;
    } else if (text.startsWith('//', index)) {
      index = text.indexOf('\n', index) === -1 ? text.length : text.indexOf('\n', index);
    } else if (text.startsWith('/*', index)) {
      index = text.indexOf('*/', index) === -1 ? text.length : text.indexOf('*/', index) + 2;
    } else {
      output += char;
      index++;
    }
  }
  return output.replace(/,(\s*[}\]])/g, '$1');
}

function stringEnd(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length && text[index] !== '"') index += text[index] === '\\' ? 2 : 1;
  return index + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
