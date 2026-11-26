export type PageDeclaration = {
  readonly name: string;
  readonly style: CSSStyleDeclaration;
  readonly selector: string;
  readonly conditions: readonly string[];
  readonly layer: string | null;
  readonly context: string;
  readonly value: string;
  readonly important: boolean;
  readonly order: number;
  readonly layerRank: readonly number[];
};

export type PageStyles = {
  readonly declarations: readonly PageDeclaration[];
  readonly syntaxes: ReadonlyMap<string, string>;
};

type Scope = {
  readonly conditions: readonly string[];
  readonly layers: readonly string[];
  readonly layerRank: readonly number[];
  readonly selectors: readonly string[] | null;
};

type Walk = {
  readonly declarations: PageDeclaration[];
  readonly syntaxes: Map<string, string>;
  readonly layerOrder: Map<string, number>;
};

const ROOT_SCOPE: Scope = { conditions: [], layers: [], layerRank: [], selectors: null };
const OWN_RULES_RANK = Number.POSITIVE_INFINITY;
const CANONICAL_PROBE = '--tuner-canon';
const RANGE_OPERATORS: Readonly<Record<string, string>> = { min: '>=', max: '<=' };
const ROOT_AND_HOST = /(^| ):root, :host$/;
const RANGE_FEATURE = /\((min|max)-(width|height): ([^)]+)\)/g;

export function readPageStyles(): PageStyles {
  const walk = startWalk();
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
    const rules = readableRules(sheet);
    if (rules === null) continue;
    const media = sheet.media.mediaText;
    walkRules(rules, media ? { ...ROOT_SCOPE, conditions: [`@media ${media}`] } : ROOT_SCOPE, walk);
  }
  return walk;
}

export function canonicalContext(selector: string, conditions: readonly string[]): string | null {
  const css = conditions.reduceRight(
    (inner, condition) => `${condition} { ${inner} }`,
    `${selector} { ${CANONICAL_PROBE}: 0 }`
  );
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const walk = startWalk();
  walkRules(sheet.cssRules, ROOT_SCOPE, walk);
  return walk.declarations.length === 1 ? walk.declarations[0].context : null;
}

export function normalizeContext(context: string): string {
  return context
    .replace(ROOT_AND_HOST, '$1:root')
    .replace(
      RANGE_FEATURE,
      (_, bound: string, feature: string, value: string) => `(${feature} ${RANGE_OPERATORS[bound]} ${value})`
    );
}

export function splitSelectorList(selector: string): readonly string[] {
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
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

function walkRules(rules: CSSRuleList, scope: Scope, walk: Walk): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const nested = { ...scope, selectors: nestSelectors(scope.selectors, splitSelectorList(rule.selectorText)) };
      collect(rule.style, nested, walk);
      walkRules(rule.cssRules, nested, walk);
    } else if (rule instanceof CSSNestedDeclarations) {
      collect(rule.style, scope, walk);
    } else if (rule instanceof CSSMediaRule) {
      walkRules(rule.cssRules, withCondition(scope, `@media ${rule.media.mediaText}`), walk);
    } else if (rule instanceof CSSSupportsRule) {
      walkRules(rule.cssRules, withCondition(scope, `@supports ${rule.conditionText}`), walk);
    } else if (rule instanceof CSSContainerRule) {
      walkRules(rule.cssRules, withCondition(scope, `@container ${rule.conditionText}`), walk);
    } else if (rule instanceof CSSLayerBlockRule) {
      walkRules(rule.cssRules, withLayer(scope, rule.name, walk), walk);
    } else if (rule instanceof CSSLayerStatementRule) {
      for (const name of rule.nameList) withLayer(scope, name, walk);
    } else if (rule instanceof CSSPropertyRule) {
      walk.syntaxes.set(rule.name, rule.syntax);
    }
  }
}

function startWalk(): Walk {
  return { declarations: [], syntaxes: new Map(), layerOrder: new Map() };
}

function withLayer(scope: Scope, name: string, walk: Walk): Scope {
  const layers = [...scope.layers, name];
  const path = layers.join('.');
  const rank = walk.layerOrder.get(path) ?? walk.layerOrder.size;
  walk.layerOrder.set(path, rank);
  return { ...scope, layers, layerRank: [...scope.layerRank, rank] };
}

function collect(style: CSSStyleDeclaration, scope: Scope, walk: Walk): void {
  if (scope.selectors === null) return;
  const selector = scope.selectors.join(', ');
  for (const name of style) {
    if (!name.startsWith('--')) continue;
    walk.declarations.push({
      name,
      style,
      selector,
      conditions: scope.conditions,
      layer: scope.layers.length > 0 ? scope.layers.join('.') : null,
      context: normalizeContext([...scope.conditions, selector].join(' ')),
      value: style.getPropertyValue(name).trim(),
      important: style.getPropertyPriority(name) === 'important',
      order: walk.declarations.length,
      layerRank: [...scope.layerRank, OWN_RULES_RANK],
    });
  }
}

function withCondition(scope: Scope, condition: string): Scope {
  return { ...scope, conditions: [...scope.conditions, condition] };
}

function readableRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    return null;
  }
}

function nestSelectors(parents: readonly string[] | null, children: readonly string[]): readonly string[] {
  if (parents === null) return children;
  const parent = parents.length === 1 ? parents[0] : `:is(${parents.join(', ')})`;
  return children.map((child) => (child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`));
}
