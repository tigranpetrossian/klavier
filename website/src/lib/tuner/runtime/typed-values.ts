import { inlineStyleOf, type StyledBox } from './page-probe';
import type { PropertyType } from './value-types';

export type Resolution = { readonly type: PropertyType; readonly resolved: string | null };

type TypedHelper = {
  readonly type: PropertyType;
  readonly name: string;
  readonly syntax: string;
  readonly initialValue: string;
};

const TYPED_HELPERS: readonly TypedHelper[] = [
  helper('color', 'rgba(1, 2, 3, 0.25)'),
  helper('integer', '-987654'),
  helper('number', '-987654.5'),
  helper('length', '-987654px'),
  helper('percentage', '-987654%'),
  helper('length-percentage', '-987653px'),
  helper('angle', '-987654deg'),
  helper('time', '-987654s'),
];

const WHITESPACE = /\s+/g;
const COMMA = /\s*,\s*/g;
const CLASSIFIER_SELECTOR = ':root';
const TEXT_PROBE = '--tuner-text';
const STYLE_ATTRIBUTE = 'style';

let initialValues: ReadonlyMap<TypedHelper, string> | null = null;
let classifier: CSSStyleDeclaration | null = null;
const rawTypes = new Map<string, PropertyType>();

export function typeOfSyntax(syntax: string): PropertyType {
  const compact = syntax.replace(WHITESPACE, '');
  return TYPED_HELPERS.find((typed) => typed.syntax === compact)?.type ?? 'text';
}

export function rawTypeOf(value: string): PropertyType {
  const known = rawTypes.get(value);
  if (known) return known;
  const type = classify(value, TYPED_HELPERS)?.type ?? 'text';
  rawTypes.set(value, type);
  return type;
}

export function sameMeaning(a: string, b: string, type: PropertyType): boolean {
  if (normalizeText(a) === normalizeText(b)) return true;
  if (type === 'text') return false;
  const computed = classify(a, helpersFor(type));
  return computed !== null && computed.resolved === classify(b, helpersFor(type))?.resolved;
}

export function parsesAs(value: string, type: PropertyType): boolean {
  if (type === 'text') return CSS.supports(TEXT_PROBE, value);
  return classify(value, helpersFor(type)) !== null;
}

export function resolveDeclaration(
  style: CSSStyleDeclaration,
  box: StyledBox,
  name: string,
  knownType: PropertyType | null
): Resolution {
  const computed = getComputedStyle(box.element, box.pseudoElement);
  const tokens = computed.getPropertyValue(name).trim();
  const inline = box.pseudoElement === null ? inlineStyleOf(box.element) : null;
  const styleAttribute = box.element.getAttribute(STYLE_ATTRIBUTE);
  // Chromium restyles every element after a stylesheet write, after var() in a registered <length> on the root,
  // and after four or more registered properties change on one element at once. One helper at a time, holding
  // the substituted tokens in the element's own inline style, restyles only that element.
  const hit = firstResolving(helpersFor(knownType), inline ?? style, tokens, computed);
  if (inline !== null && styleAttribute === null) box.element.removeAttribute(STYLE_ATTRIBUTE);
  if (hit !== null) return hit;
  if (knownType !== null && knownType !== 'text') return { type: knownType, resolved: null };
  return { type: 'text', resolved: tokens === '' ? null : tokens };
}

function firstResolving(
  helpers: readonly TypedHelper[],
  target: CSSStyleDeclaration,
  tokens: string,
  computed: CSSStyleDeclaration
): Resolution | null {
  for (const typed of helpers) {
    target.setProperty(typed.name, tokens);
    const hit = firstAccepting([typed], computed);
    target.removeProperty(typed.name);
    if (hit !== null) return hit;
  }
  return null;
}

function normalizeText(value: string): string {
  return value.replace(WHITESPACE, ' ').replace(COMMA, ', ').trim();
}

function classify(value: string, helpers: readonly TypedHelper[]): Resolution | null {
  ensureRegistered();
  const style = classifierStyle();
  for (const typed of helpers) style.setProperty(typed.name, value);
  const hit = firstAccepting(helpers, getComputedStyle(document.documentElement));
  for (const typed of helpers) style.removeProperty(typed.name);
  return hit;
}

function classifierStyle(): CSSStyleDeclaration {
  if (classifier !== null) return classifier;
  const sheet = new CSSStyleSheet();
  sheet.insertRule(`${CLASSIFIER_SELECTOR} {}`);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const [rule] = sheet.cssRules;
  if (!(rule instanceof CSSStyleRule)) throw new Error('The tuner classifier rule is not a style rule');
  classifier = rule.style;
  return classifier;
}

function helpersFor(knownType: PropertyType | null): readonly TypedHelper[] {
  ensureRegistered();
  return knownType === null ? TYPED_HELPERS : TYPED_HELPERS.filter((typed) => typed.type === knownType);
}

function firstAccepting(helpers: readonly TypedHelper[], computed: CSSStyleDeclaration): Resolution | null {
  for (const typed of helpers) {
    const value = computed.getPropertyValue(typed.name).trim();
    if (value !== initialValues?.get(typed)) return { type: typed.type, resolved: value };
  }
  return null;
}

function ensureRegistered(): void {
  if (initialValues !== null) return;
  for (const typed of TYPED_HELPERS) registerHelper(typed);
  const computed = getComputedStyle(document.documentElement);
  initialValues = new Map(TYPED_HELPERS.map((typed) => [typed, computed.getPropertyValue(typed.name).trim()]));
}

function registerHelper({ name, syntax, initialValue }: TypedHelper): void {
  try {
    CSS.registerProperty({ name, syntax, inherits: false, initialValue });
  } catch {
    // CSS.registerProperty throws when the name is already registered, as it is after this module reloads.
  }
}

function helper(type: PropertyType, initialValue: string): TypedHelper {
  return { type, name: `--tuner-t-${type}`, syntax: `<${type}>`, initialValue };
}
