import { parse } from '@babel/parser';
import { isValidIdentifier, traverseFast, type File, type Node } from '@babel/types';
import type { SourceEdit } from './source-edits.ts';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';

const MARKER_NAME = 'tunable';
const TYPESCRIPT_ONLY_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);

export type PlainData = null | boolean | number | string | readonly PlainData[] | { readonly [key: string]: PlainData };

type Quote = '"' | "'";

type Literal =
  | {
      kind: 'primitive';
      value: null | boolean | number | string;
      start: number;
      end: number;
      quote: Quote | null;
    }
  | { kind: 'array'; items: readonly Literal[]; start: number; end: number }
  | {
      kind: 'object';
      entries: readonly LiteralEntry[];
      start: number;
      end: number;
    };

type LiteralEntry = { key: string; quotedKey: boolean; value: Literal };

type LiteralStyle = { quote: Quote; quotedKeys: boolean };

export type TunableCall = {
  id: string;
  literal: Literal | null;
  style: LiteralStyle;
};

export function readTunableCalls(text: string, file: string): readonly TunableCall[] | null {
  const ast = parseScript(text, file);
  if (ast === null) return null;
  const calls: TunableCall[] = [];
  traverseFast(ast, (node) => {
    const call = tunableCallOf(text, node);
    if (call !== null) calls.push(call);
  });
  return calls;
}

export function valueOfLiteral(literal: Literal): PlainData {
  if (literal.kind === 'primitive') return literal.value;
  if (literal.kind === 'array') return literal.items.map(valueOfLiteral);
  return Object.fromEntries(literal.entries.map((entry) => [entry.key, valueOfLiteral(entry.value)]));
}

export function literalEdits(literal: Literal, next: PlainData, style: LiteralStyle): readonly SourceEdit[] {
  if (isDeepStrictEqual(valueOfLiteral(literal), next)) return [];
  if (literal.kind === 'array' && isList(next) && next.length === literal.items.length) {
    return literal.items.flatMap((item, index) => literalEdits(item, next[index], style));
  }
  if (literal.kind === 'object' && isRecord(next) && hasSameKeys(literal.entries, next)) {
    return literal.entries.flatMap((entry) => literalEdits(entry.value, next[entry.key], style));
  }
  const quote = literal.kind === 'primitive' && literal.quote !== null ? literal.quote : style.quote;
  return [
    {
      start: literal.start,
      end: literal.end,
      text: printLiteral(next, { ...style, quote }),
    },
  ];
}

function parseScript(text: string, file: string): File | null {
  try {
    return parse(text, {
      sourceType: 'module',
      plugins: TYPESCRIPT_ONLY_EXTENSIONS.has(path.extname(file)) ? ['typescript'] : ['typescript', 'jsx'],
    });
  } catch {
    return null;
  }
}

function tunableCallOf(text: string, node: Node): TunableCall | null {
  if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== MARKER_NAME) {
    return null;
  }
  const [id, defaultValue] = node.arguments;
  if (id?.type !== 'StringLiteral') return null;
  const literal = defaultValue === undefined ? null : readLiteral(text, defaultValue);
  const quote = quoteAt(text, id.start);
  return {
    id: id.value,
    literal,
    style: {
      quote: quote ?? "'",
      quotedKeys: literal !== null && hasQuotedKeys(literal),
    },
  };
}

function readLiteral(text: string, node: Node): Literal | null {
  const { start, end } = node;
  if (start === null || start === undefined || end === null || end === undefined) {
    return null;
  }
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'ParenthesizedExpression':
      return readLiteral(text, node.expression);
    case 'NullLiteral':
      return { kind: 'primitive', value: null, start, end, quote: null };
    case 'BooleanLiteral':
    case 'NumericLiteral':
      return { kind: 'primitive', value: node.value, start, end, quote: null };
    case 'StringLiteral':
      return {
        kind: 'primitive',
        value: node.value,
        start,
        end,
        quote: quoteAt(text, start),
      };
    case 'UnaryExpression':
      return node.operator === '-' && node.argument.type === 'NumericLiteral'
        ? {
            kind: 'primitive',
            value: -node.argument.value,
            start,
            end,
            quote: null,
          }
        : null;
    case 'ArrayExpression':
      return readArray(text, node.elements, start, end);
    case 'ObjectExpression':
      return readObject(text, node.properties, start, end);
    default:
      return null;
  }
}

function readArray(text: string, elements: readonly (Node | null)[], start: number, end: number): Literal | null {
  const items: Literal[] = [];
  for (const element of elements) {
    const item = element === null ? null : readLiteral(text, element);
    if (item === null) return null;
    items.push(item);
  }
  return { kind: 'array', items, start, end };
}

function readObject(text: string, properties: readonly Node[], start: number, end: number): Literal | null {
  const entries: LiteralEntry[] = [];
  for (const property of properties) {
    if (property.type !== 'ObjectProperty' || property.computed) return null;
    const key = keyOf(property.key);
    const value = readLiteral(text, property.value);
    if (key === null || value === null) return null;
    entries.push({ ...key, value });
  }
  return { kind: 'object', entries, start, end };
}

function keyOf(key: Node): { key: string; quotedKey: boolean } | null {
  if (key.type === 'Identifier') return { key: key.name, quotedKey: false };
  if (key.type === 'StringLiteral') return { key: key.value, quotedKey: true };
  if (key.type === 'NumericLiteral') {
    return { key: String(key.value), quotedKey: false };
  }
  return null;
}

function hasQuotedKeys(literal: Literal): boolean {
  if (literal.kind === 'primitive') return false;
  if (literal.kind === 'array') return literal.items.some(hasQuotedKeys);
  const [first] = literal.entries;
  return first !== undefined ? first.quotedKey : false;
}

function hasSameKeys(entries: readonly LiteralEntry[], next: { readonly [key: string]: PlainData }): boolean {
  return Object.keys(next).length === entries.length && entries.every((entry) => Object.hasOwn(next, entry.key));
}

function printLiteral(value: PlainData, style: LiteralStyle): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') return quoteString(value, style.quote);
  if (isList(value)) {
    return `[${value.map((item) => printLiteral(item, style)).join(', ')}]`;
  }
  const entries = Object.entries(value).map(([key, item]) => `${printKey(key, style)}: ${printLiteral(item, style)}`);
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

function printKey(key: string, style: LiteralStyle): string {
  return !style.quotedKeys && isValidIdentifier(key) ? key : quoteString(key, style.quote);
}

function quoteString(value: string, quote: Quote): string {
  const json = JSON.stringify(value);
  if (quote === '"') return json;
  const body = json.slice(1, -1).replace(/\\(.)|'/g, (match: string, escaped: string | undefined) => {
    if (escaped === undefined) return "\\'";
    return escaped === '"' ? '"' : match;
  });
  return `'${body}'`;
}

function quoteAt(text: string, offset: number | null | undefined): Quote | null {
  const char = offset === null || offset === undefined ? undefined : text[offset];
  return char === '"' || char === "'" ? char : null;
}

function isList(value: PlainData): value is readonly PlainData[] {
  return Array.isArray(value);
}

function isRecord(value: PlainData): value is { readonly [key: string]: PlainData } {
  return typeof value === 'object' && value !== null && !isList(value);
}
