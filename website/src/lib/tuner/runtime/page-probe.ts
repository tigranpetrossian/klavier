import { splitSelectorList, type PageDeclaration } from './page-styles';

export type StyledBox = { readonly element: Element; readonly pseudoElement: string | null };

export type PageProbe = {
  readonly placements: ReadonlyMap<PageDeclaration, StyledBox>;
  winnerOn(box: StyledBox, name: string): PageDeclaration | null;
};

type WinnerOn = (box: StyledBox, name: string) => PageDeclaration | null;

type BoxIndex = Map<Element, Map<string | null, StyledBox>>;

const SHADOW_PREFIX = '--tuner-w-';
const SENTINEL_PREFIX = 'tuner-s';
const PSEUDO_ELEMENT = /(::[\w-]+(?:\([^)]*\))?|:(?:before|after|first-line|first-letter))$/i;
const ANY_ELEMENT = '*';

export function probePage(declarations: readonly PageDeclaration[], placed: readonly PageDeclaration[]): PageProbe {
  const names = new Set(placed.map((declaration) => declaration.name));
  const shadowed = declarations.filter((declaration) => names.has(declaration.name));
  return withShadows(shadowed, (winnerOn) => {
    const placements = placeEach(placed, winnerOn);
    const winners = new Map([...new Set(placements.values())].map((box) => [box, winnersOn(box, names, winnerOn)]));
    return { placements, winnerOn: (box, name) => winners.get(box)?.get(name) ?? null };
  });
}

export function inlineStyleOf(element: Element): CSSStyleDeclaration | null {
  return element instanceof HTMLElement || element instanceof SVGElement ? element.style : null;
}

function placeEach(placed: readonly PageDeclaration[], winnerOn: WinnerOn): ReadonlyMap<PageDeclaration, StyledBox> {
  const index: BoxIndex = new Map();
  const placements = new Map<PageDeclaration, StyledBox>();
  for (const [selector, group] of groupBySelector(placed)) {
    let unplaced = group;
    for (const box of matchingBoxes(selector, index)) {
      if (unplaced.length === 0) break;
      for (const declaration of unplaced)
        if (winnerOn(box, declaration.name) === declaration) placements.set(declaration, box);
      unplaced = unplaced.filter((declaration) => !placements.has(declaration));
    }
  }
  return placements;
}

function winnersOn(
  box: StyledBox,
  names: ReadonlySet<string>,
  winnerOn: WinnerOn
): ReadonlyMap<string, PageDeclaration | null> {
  return new Map([...names].map((name) => [name, winnerOn(box, name)]));
}

function withShadows<T>(declarations: readonly PageDeclaration[], read: (winnerOn: WinnerOn) => T): T {
  const bySentinel = new Map<string, PageDeclaration>();
  declarations.forEach((declaration, index) => {
    const sentinel = `${SENTINEL_PREFIX}${index}`;
    declaration.style.setProperty(
      shadowOf(declaration.name),
      sentinel,
      declaration.style.getPropertyPriority(declaration.name)
    );
    bySentinel.set(sentinel, declaration);
  });
  const computedStyles = new Map<StyledBox, CSSStyleDeclaration>();
  const computedStyleOf = (box: StyledBox) => {
    const computed = computedStyles.get(box) ?? getComputedStyle(box.element, box.pseudoElement);
    computedStyles.set(box, computed);
    return computed;
  };
  try {
    return read((box, name) => winnerOf(box, computedStyleOf(box), name, bySentinel));
  } finally {
    for (const declaration of declarations) declaration.style.removeProperty(shadowOf(declaration.name));
  }
}

function winnerOf(
  box: StyledBox,
  computed: CSSStyleDeclaration,
  name: string,
  bySentinel: ReadonlyMap<string, PageDeclaration>
): PageDeclaration | null {
  const winner = bySentinel.get(computed.getPropertyValue(shadowOf(name)).trim()) ?? null;
  const inline = box.pseudoElement === null ? inlineStyleOf(box.element) : null;
  if (inline === null || inline.getPropertyValue(name) === '') return winner;
  const inlineWins = inline.getPropertyPriority(name) === 'important' || !winner?.important;
  return inlineWins ? null : winner;
}

function groupBySelector(declarations: readonly PageDeclaration[]): ReadonlyMap<string, readonly PageDeclaration[]> {
  const groups = new Map<string, PageDeclaration[]>();
  for (const declaration of declarations)
    groups.set(declaration.selector, [...(groups.get(declaration.selector) ?? []), declaration]);
  return groups;
}

function matchingBoxes(selectorList: string, index: BoxIndex): readonly StyledBox[] {
  return splitSelectorList(selectorList).flatMap((selector) => {
    const pseudoElement = PSEUDO_ELEMENT.exec(selector)?.[1] ?? null;
    const elementSelector = pseudoElement === null ? selector : selector.slice(0, -pseudoElement.length) || ANY_ELEMENT;
    return matchingElements(elementSelector).map((element) => indexedBox(index, element, pseudoElement));
  });
}

function indexedBox(index: BoxIndex, element: Element, pseudoElement: string | null): StyledBox {
  const byPseudoElement = index.get(element) ?? new Map<string | null, StyledBox>();
  index.set(element, byPseudoElement);
  const box = byPseudoElement.get(pseudoElement) ?? { element, pseudoElement };
  byPseudoElement.set(pseudoElement, box);
  return box;
}

function matchingElements(selector: string): readonly Element[] {
  try {
    return [...document.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

function shadowOf(name: string): string {
  return `${SHADOW_PREFIX}${name.slice(2)}`;
}
