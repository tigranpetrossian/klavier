import postcss, {
  CssSyntaxError,
  type AtRule,
  type Container,
  type Declaration,
  type Document,
  type Root,
  type Rule,
} from 'postcss';
import type { SourceDeclaration } from '../shared/declarations-protocol.ts';

const CONDITION_AT_RULES = new Set(['media', 'supports', 'container']);
const THEME_SELECTOR = ':root';
const THEME_LAYER = 'theme';

export type ValueSpan = { start: number; end: number };

export type FileDeclaration = Omit<SourceDeclaration, 'file'>;

export type CssDeclaration = {
  declaration: FileDeclaration;
  valueSpan: ValueSpan;
};

export type CssDeclarationsResult =
  { ok: true; declarations: readonly CssDeclaration[] } | { ok: false; reason: string };

type ParseResult = { ok: true; root: Root } | { ok: false; reason: string };

export function readCssDeclarations(text: string): CssDeclarationsResult {
  const parsed = parseCss(text);
  if (!parsed.ok) return parsed;
  const declarations: CssDeclaration[] = [];
  parsed.root.walkDecls((node) => {
    const declaration = declarationOf(text, node);
    if (declaration !== null) declarations.push(declaration);
  });
  return { ok: true, declarations: markShadowed(declarations) };
}

function parseCss(text: string): ParseResult {
  try {
    return { ok: true, root: postcss.parse(text) };
  } catch (error) {
    return { ok: false, reason: parseFailureReason(error) };
  }
}

function parseFailureReason(error: unknown): string {
  if (error instanceof CssSyntaxError) {
    return `${error.reason} at line ${error.line ?? '?'}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function declarationOf(text: string, declaration: Declaration): CssDeclaration | null {
  if (!declaration.prop.startsWith('--')) return null;
  const scope = scopeOf(declaration);
  const valueSpan = valueSpanOf(declaration);
  const line = declaration.source?.start?.line;
  if (scope === null || valueSpan === null || line === undefined) return null;
  const context = collapseWhitespace([...scope.conditions, scope.selector].join(' '));
  const fileDeclaration = {
    id: `${declaration.prop}|${context}`,
    name: declaration.prop,
    context,
    line,
    value: text.slice(valueSpan.start, valueSpan.end),
    important: declaration.important === true,
    selector: scope.selector,
    conditions: scope.conditions,
    layer: scope.layer,
    theme: scope.theme,
    unsupported: scope.unsupported,
    shadowed: false,
  };
  return { declaration: fileDeclaration, valueSpan };
}

type Scope = {
  selector: string;
  conditions: readonly string[];
  layer: string | null;
  theme: readonly string[] | null;
  unsupported: readonly string[];
};

function scopeOf(declaration: Declaration): Scope | null {
  let selectors: readonly string[] | null = null;
  let theme: readonly string[] | null = null;
  const conditions: string[] = [];
  const layers: string[] = [];
  const unsupported: string[] = [];
  for (const node of ancestorsOf(declaration)) {
    if (node.type === 'rule') {
      selectors = nestSelectors(selectors, splitSelectorList(node.selector));
      continue;
    }
    const name = node.name.toLowerCase();
    const condition = collapseWhitespace(`@${name} ${node.params}`);
    if (CONDITION_AT_RULES.has(name)) conditions.push(condition);
    else if (name === 'layer') layers.push(collapseWhitespace(node.params));
    else if (name === 'theme') theme = node.params.split(/\s+/).filter(Boolean);
    else {
      unsupported.push(condition);
      conditions.push(condition);
    }
  }
  if (theme !== null) {
    return {
      selector: THEME_SELECTOR,
      conditions,
      layer: THEME_LAYER,
      theme,
      unsupported,
    };
  }
  if (selectors === null) return null;
  const layer = layers.length > 0 ? layers.join('.') : null;
  return {
    selector: selectors.join(', '),
    conditions,
    layer,
    theme: null,
    unsupported,
  };
}

function ancestorsOf(declaration: Declaration): readonly (AtRule | Rule)[] {
  const chain: (AtRule | Rule)[] = [];
  for (let node: Container | Document | undefined = declaration.parent; node !== undefined; node = node.parent) {
    if (isScopeNode(node)) chain.unshift(node);
  }
  return chain;
}

function isScopeNode(node: Container | Document): node is AtRule | Rule {
  return node.type === 'rule' || node.type === 'atrule';
}

function nestSelectors(parents: readonly string[] | null, children: readonly string[]): readonly string[] {
  if (parents === null) return children;
  const parent = parents.length === 1 ? parents[0] : `:is(${parents.join(', ')})`;
  return children.map((child) => (child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`));
}

function splitSelectorList(selector: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const char of selector) {
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(collapseWhitespace(current));
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(collapseWhitespace(current));
  return parts;
}

function valueSpanOf(declaration: Declaration): ValueSpan | null {
  const start = declaration.source?.start?.offset;
  const between = declaration.raws.between;
  if (start === undefined || between === undefined) return null;
  const rawStart = start + declaration.prop.length + between.length;
  const raw = declaration.raws.value?.raw ?? declaration.value;
  const content = contentBoundsOf(raw);
  return { start: rawStart + content.start, end: rawStart + content.end };
}

function contentBoundsOf(raw: string): { start: number; end: number } {
  let start: number | null = null;
  let end = 0;
  let index = 0;
  while (index < raw.length) {
    if (raw.startsWith('/*', index)) {
      const close = raw.indexOf('*/', index + 2);
      index = close === -1 ? raw.length : close + 2;
      continue;
    }
    const char = raw[index];
    const next = char === '"' || char === "'" ? endOfString(raw, index) : index + 1;
    if (!/\s/.test(char)) {
      start ??= index;
      end = next;
    }
    index = next;
  }
  return { start: start ?? 0, end: start === null ? 0 : end };
}

function endOfString(raw: string, open: number): number {
  for (let index = open + 1; index < raw.length; index += 1) {
    if (raw[index] === '\\') index += 1;
    else if (raw[index] === raw[open]) return index + 1;
  }
  return raw.length;
}

function markShadowed(declarations: readonly CssDeclaration[]): readonly CssDeclaration[] {
  const last = new Map<string, CssDeclaration>();
  for (const declaration of declarations) {
    last.set(shadowKeyOf(declaration), declaration);
  }
  return declarations.map((located) => ({
    ...located,
    declaration: {
      ...located.declaration,
      shadowed: last.get(shadowKeyOf(located)) !== located,
    },
  }));
}

function shadowKeyOf({ declaration }: CssDeclaration): string {
  return `${declaration.id}|${declaration.layer}`;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
