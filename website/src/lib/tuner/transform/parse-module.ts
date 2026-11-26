import { parse, type ParserPlugin } from '@babel/parser';
import type * as t from '@babel/types';

const TYPESCRIPT_ONLY = /\.[cm]?ts$/;

export function parseModule(source: string, file: string): t.File | null {
  const plugins: ParserPlugin[] = TYPESCRIPT_ONLY.test(file) ? ['typescript'] : ['typescript', 'jsx'];
  try {
    return parse(source, { sourceType: 'module', sourceFilename: file, plugins });
  } catch {
    return null;
  }
}
