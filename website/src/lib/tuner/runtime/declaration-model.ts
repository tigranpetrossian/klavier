import type { SourceDeclaration } from '../shared/declarations-protocol';
import { normalizeContext, type PageDeclaration, type PageStyles } from './page-styles';
import type { SourceLocation } from './value-types';

export type PlacedSource = {
  readonly source: SourceDeclaration;
  readonly pageContext: string | null;
  readonly pageSelector: string | null;
};

export type PropertyDeclaration = {
  readonly id: string;
  readonly name: string;
  readonly context: string;
  readonly source: SourceDeclaration | null;
  readonly claims: readonly PageDeclaration[];
  readonly defaultValue: string;
  readonly location: SourceLocation | null;
};

export type Duplicate = { readonly declaration: PropertyDeclaration; readonly winner: PropertyDeclaration };

export type DeclarationModel = {
  readonly page: PageStyles;
  readonly declarations: readonly PropertyDeclaration[];
  readonly byId: ReadonlyMap<string, PropertyDeclaration>;
  readonly byName: ReadonlyMap<string, readonly PropertyDeclaration[]>;
  readonly owners: ReadonlyMap<PageDeclaration, PropertyDeclaration>;
  readonly duplicates: readonly Duplicate[];
  readonly unplaced: readonly PropertyDeclaration[];
};

export const EMPTY_MODEL: DeclarationModel = {
  page: { declarations: [], syntaxes: new Map() },
  declarations: [],
  byId: new Map(),
  byName: new Map(),
  owners: new Map(),
  duplicates: [],
  unplaced: [],
};

const TAILWIND_INTERNAL_LAYER = 'properties';
const TAILWIND_INTERNAL_PREFIX = '--tw-';
const INLINE_THEME_OPTION = 'inline';
const LIGHTNING_COLOR_FALLBACK = /^@supports \(color: (?:lab\(0% 0 0\)|color\(display-p3 0 0 0\))\) /;

export function propertyId(name: string, context: string): string {
  return `${name}|${context}`;
}

export function buildDeclarationModel(sources: readonly PlacedSource[], page: PageStyles): DeclarationModel {
  const pageByKey = groupBy(page.declarations, matchKeyOf);
  const exact = new Map(sources.map((placed) => [placed, exactClaims(placed, pageByKey)]));
  const paired = pairLeftovers(exact, page);
  const candidates = sources.map((placed) =>
    sourceDeclaration(placed.source, paired.get(placed) ?? exact.get(placed) ?? [])
  );
  const duplicates = findDuplicates(candidates);
  const losers = new Set(duplicates.map((duplicate) => duplicate.declaration));
  const claimed = new Set(candidates.flatMap((declaration) => declaration.claims));
  const unclaimed = page.declarations.filter(
    (declaration) => !claimed.has(declaration) && !isTailwindInternal(declaration)
  );
  const all = [...candidates.filter((declaration) => !losers.has(declaration)), ...readOnlyDeclarations(unclaimed)];
  return {
    page,
    declarations: all,
    byId: new Map(all.map((declaration) => [declaration.id, declaration])),
    byName: groupBy(all, (declaration) => declaration.name),
    owners: new Map(all.flatMap((declaration) => declaration.claims.map((claim) => [claim, declaration]))),
    duplicates,
    unplaced: candidates.filter(
      (declaration) => declaration.claims.length === 0 && (declaration.source?.unsupported.length ?? 0) > 0
    ),
  };
}

function pairLeftovers(
  exact: ReadonlyMap<PlacedSource, readonly PageDeclaration[]>,
  page: PageStyles
): ReadonlyMap<PlacedSource, readonly PageDeclaration[]> {
  const claimed = new Set([...exact.values()].flat());
  const leftoverSources = [...exact].flatMap(([placed, claims]) =>
    claims.length === 0 && canClaim(placed.source) ? [placed] : []
  );
  const leftoverPage = page.declarations.filter(
    (declaration) => !claimed.has(declaration) && !isTailwindInternal(declaration)
  );
  const pageByPair = groupBy(leftoverPage, (declaration) =>
    pairKey(declaration.name, normalizeContext(declaration.selector), declaration.layer)
  );
  const sourcesByPair = groupBy(leftoverSources, ({ source, pageSelector }) =>
    pairKey(source.name, pageSelector, source.layer)
  );
  const pairs = new Map<PlacedSource, readonly PageDeclaration[]>();
  for (const [key, group] of sourcesByPair) {
    const candidates = pageByPair.get(key) ?? [];
    if (group.length === 1 && candidates.length === 1) pairs.set(group[0], candidates);
  }
  return pairs;
}

function findDuplicates(candidates: readonly PropertyDeclaration[]): readonly Duplicate[] {
  return [...groupBy(candidates, (declaration) => declaration.id).values()].flatMap((group) => {
    const winner = group.reduce((holder, challenger) => (outranks(challenger, holder) ? challenger : holder));
    return group.filter((declaration) => declaration !== winner).map((declaration) => ({ declaration, winner }));
  });
}

function outranks(challenger: PropertyDeclaration, holder: PropertyDeclaration): boolean {
  if (isShadowed(challenger) !== isShadowed(holder)) return isShadowed(holder);
  return compareCascade(strongestClaim(challenger), strongestClaim(holder)) >= 0;
}

function strongestClaim({ claims }: PropertyDeclaration): PageDeclaration | null {
  return claims.reduce<PageDeclaration | null>(
    (strongest, claim) => (compareCascade(claim, strongest) > 0 ? claim : strongest),
    null
  );
}

function compareCascade(a: PageDeclaration | null, b: PageDeclaration | null): number {
  if (a === null || b === null) return (a === null ? 0 : 1) - (b === null ? 0 : 1);
  if (a.important !== b.important) return a.important ? 1 : -1;
  const layers = compareRanks(a.layerRank, b.layerRank);
  if (layers !== 0) return a.important ? -layers : layers;
  return a.order - b.order;
}

function compareRanks(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function isShadowed({ source }: PropertyDeclaration): boolean {
  return source?.shadowed === true;
}

function exactClaims(
  { source, pageContext }: PlacedSource,
  pageByKey: ReadonlyMap<string, readonly PageDeclaration[]>
): readonly PageDeclaration[] {
  if (pageContext === null || !canClaim(source)) return [];
  return pageByKey.get(matchKey(source.name, pageContext, source.layer)) ?? [];
}

function canClaim(source: SourceDeclaration): boolean {
  return !source.shadowed && source.theme?.includes(INLINE_THEME_OPTION) !== true;
}

function matchKeyOf({ name, context, layer }: PageDeclaration): string {
  return matchKey(name, context.replace(LIGHTNING_COLOR_FALLBACK, ''), layer);
}

function readOnlyDeclarations(unclaimed: readonly PageDeclaration[]): readonly PropertyDeclaration[] {
  return [...groupBy(unclaimed, readOnlyId)].map(([id, claims]) => {
    const winner = claims.reduce((holder, challenger) =>
      compareCascade(challenger, holder) >= 0 ? challenger : holder
    );
    return {
      id,
      name: winner.name,
      context: readOnlyContext(winner),
      source: null,
      claims,
      defaultValue: winner.value,
      location: null,
    };
  });
}

function readOnlyId(declaration: PageDeclaration): string {
  return propertyId(declaration.name, readOnlyContext(declaration));
}

function readOnlyContext({ layer, context }: PageDeclaration): string {
  const unaliased = context.replace(LIGHTNING_COLOR_FALLBACK, '');
  return layer === null ? unaliased : `@layer ${layer} ${unaliased}`;
}

function isTailwindInternal({ name, layer }: PageDeclaration): boolean {
  return (
    name.startsWith(TAILWIND_INTERNAL_PREFIX) ||
    layer === TAILWIND_INTERNAL_LAYER ||
    layer?.startsWith(`${TAILWIND_INTERNAL_LAYER}.`) === true
  );
}

function sourceDeclaration(source: SourceDeclaration, claims: readonly PageDeclaration[]): PropertyDeclaration {
  return {
    id: source.id,
    name: source.name,
    context: source.context,
    source,
    claims,
    defaultValue: source.value,
    location: { file: source.file, line: source.line },
  };
}

function matchKey(name: string, context: string, layer: string | null): string {
  return JSON.stringify(['context', name, context, layer]);
}

function pairKey(name: string, selector: string | null, layer: string | null): string {
  return JSON.stringify(['selector', name, selector, layer]);
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return groups;
}
