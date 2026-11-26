import { readCssDeclarations, type CssDeclaration } from './css-declarations.ts';
import { literalEdits, readTunableCalls, valueOfLiteral, type PlainData, type TunableCall } from './script-literals.ts';
import type { SaveItem } from './save-request.ts';
import type { SourceEdit } from './source-edits.ts';
import path from 'node:path';

const STYLESHEET_EXTENSION = '.css';

const SKIP_REASONS = {
  notFound: 'Not found in the file',
  duplicated: 'Appears more than once in the file',
  unparseable: 'The file does not parse',
  notLiteral: 'The default in the file is not a literal',
};

export type Found = { ok: true; current: unknown; edits(): readonly SourceEdit[] } | { ok: false; reason: string };

export type SourceIndex = (item: SaveItem) => Found;

export function indexSource(file: string, text: string): SourceIndex {
  return path.extname(file) === STYLESHEET_EXTENSION ? indexStylesheet(text) : indexScript(file, text);
}

function indexStylesheet(text: string): SourceIndex {
  const read = readCssDeclarations(text);
  if (!read.ok) {
    return () => ({ ok: false, reason: SKIP_REASONS.unparseable });
  }
  return (item) => {
    if (item.kind !== 'property') {
      return { ok: false, reason: SKIP_REASONS.notFound };
    }
    const matches = read.declarations.filter(
      ({ declaration }) => declaration.name === item.name && declaration.context === item.context
    );
    return single(matches, (located) => foundDeclaration(located, item.value));
  };
}

function indexScript(file: string, text: string): SourceIndex {
  const calls = readTunableCalls(text, file);
  if (calls === null) {
    return () => ({ ok: false, reason: SKIP_REASONS.unparseable });
  }
  return (item) => {
    if (item.kind !== 'constant') {
      return { ok: false, reason: SKIP_REASONS.notFound };
    }
    return single(
      calls.filter((call) => call.id === item.id),
      (call) => foundConstant(call, item.value)
    );
  };
}

function foundConstant({ literal, style }: TunableCall, value: PlainData): Found {
  if (literal === null) return { ok: false, reason: SKIP_REASONS.notLiteral };
  return {
    ok: true,
    current: valueOfLiteral(literal),
    edits: () => literalEdits(literal, value, style),
  };
}

function foundDeclaration({ declaration, valueSpan }: CssDeclaration, value: string): Found {
  return {
    ok: true,
    current: declaration.value,
    edits: () => [{ ...valueSpan, text: value }],
  };
}

function single<T>(matches: readonly T[], found: (match: T) => Found): Found {
  const [first, ...rest] = matches;
  if (first === undefined) return { ok: false, reason: SKIP_REASONS.notFound };
  if (rest.length > 0) return { ok: false, reason: SKIP_REASONS.duplicated };
  return found(first);
}
