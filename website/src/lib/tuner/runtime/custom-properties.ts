import type { SourceDeclaration } from '../shared/declarations-protocol';
import {
  buildDeclarationModel,
  EMPTY_MODEL,
  type DeclarationModel,
  type PlacedSource,
  type PropertyDeclaration,
} from './declaration-model';
import { reportModelProblems, reportSourceProblems } from './declaration-problems';
import { requestDeclarations } from './declarations-request';
import { showOnPage } from './page-overrides';
import { readPage, type PageReading } from './page-readings';
import { canonicalContext, readPageStyles } from './page-styles';
import { watchMediaConditions, watchPage, type PageWatch } from './page-watch';
import { reportWarning } from './problems';
import { fitsTarget, formOf, referenceTarget, referenceTo, refersTo } from './property-references';
import {
  refreshValues,
  registerValues,
  setValue,
  unregisterValues,
  type SaveCandidate,
  type ValueAdapter,
} from './session-store';
import { parsesAs, sameMeaning } from './typed-values';
import type { Presence, PropertyEntry } from './value-types';

type Tracking = { starts: number; readonly pageWatch: PageWatch; stopWatchingMedia: () => void };

const READ_ONLY_REASON = 'The declaration is read-only';

let sources: readonly SourceDeclaration[] = [];
let model: DeclarationModel = EMPTY_MODEL;
let reading: PageReading = readPage(EMPTY_MODEL, ownWrites);
let tracking: Tracking | null = null;
let latestLoad = 0;
const appliedValues = new Map<string, string>();

export function startPropertyTuning(): () => void {
  if (tracking) tracking.starts++;
  else {
    tracking = {
      starts: 1,
      pageWatch: watchPage({ onStylesheetsChanged: rescanStylesheets, onPageChanged: rereadPage }),
      stopWatchingMedia: () => {},
    };
    void loadSources();
  }
  return stopPropertyTuning;
}

export function pointProperty(id: string, target: string): boolean {
  const reference = referenceTo(target);
  return reference !== null && setValue(id, reference);
}

export function detachProperty(id: string): boolean {
  const declaration = model.byId.get(id);
  const detached = declaration && detachedValue(declaration);
  return typeof detached === 'string' && setValue(id, detached);
}

export function propertyTargets(id: string): readonly string[] {
  const declaration = model.byId.get(id);
  return declaration ? [...model.byName.keys()].filter((name) => acceptsTarget(declaration, name)) : [];
}

function stopPropertyTuning(): void {
  if (!tracking) return;
  tracking.starts--;
  if (tracking.starts > 0) return;
  tracking.pageWatch.stop();
  tracking.stopWatchingMedia();
  tracking = null;
  unregisterValues(model.declarations.map((declaration) => declaration.id));
  model = EMPTY_MODEL;
  reading = readPage(EMPTY_MODEL, ownWrites);
}

async function loadSources(): Promise<void> {
  const load = ++latestLoad;
  const result = await requestDeclarations();
  if (tracking === null || load !== latestLoad) return;
  if (result.ok) {
    sources = result.declarations;
    reportSourceProblems(result.problems);
  } else {
    reportWarning(`Can't load custom property declarations: ${result.reason}.`);
  }
  rebuild();
}

function rescanStylesheets(): void {
  if (tracking === null) return;
  rebuild();
  void loadSources();
}

function ownWrites<T>(write: () => T): T {
  return tracking ? tracking.pageWatch.ignoringOwnWrites(write) : write();
}

function rereadPage(): void {
  reading = readPage(model, ownWrites);
  refreshValues();
}

function rebuild(): void {
  const next = buildDeclarationModel(sources.map(placeSource), readPageStyles());
  const kept = new Set(next.declarations.map((declaration) => declaration.id));
  unregisterValues(model.declarations.map((declaration) => declaration.id).filter((id) => !kept.has(id)));
  model = next;
  reading = readPage(next, ownWrites);
  reportModelProblems(next);
  if (tracking) {
    tracking.stopWatchingMedia();
    tracking.stopWatchingMedia = watchMediaConditions(
      next.page.declarations.flatMap((declaration) => declaration.conditions),
      rereadPage
    );
  }
  registerValues(next.declarations.map(declarationAdapter));
}

function placeSource(source: SourceDeclaration): PlacedSource {
  return {
    source,
    pageContext: source.unsupported.length > 0 ? null : canonicalContext(source.selector, source.conditions),
    pageSelector: canonicalContext(source.selector, []),
  };
}

function declarationAdapter(declaration: PropertyDeclaration): ValueAdapter {
  const valueOf = (value: unknown) => (typeof value === 'string' ? value : declaration.defaultValue);
  return {
    id: declaration.id,
    defaultValue: declaration.defaultValue,
    location: declaration.location,
    editable: declaration.source !== null,
    isDefault: (value) => typeof value === 'string' && isDefaultValue(declaration, value),
    fits: (value) => typeof value === 'string' && acceptsValue(declaration, value),
    apply: (value) => applyValue(declaration, valueOf(value)),
    describe: (value, changed) => describeDeclaration(declaration, valueOf(value), changed),
    saveValue: (value) => saveCandidate(declaration, value),
  };
}

function isDefaultValue(declaration: PropertyDeclaration, value: string): boolean {
  const bothRaw = formOf(value) === 'raw' && formOf(declaration.defaultValue) === 'raw';
  return sameMeaning(value, declaration.defaultValue, bothRaw ? reading.typeOf(declaration) : 'text');
}

function acceptsValue(declaration: PropertyDeclaration, value: string): boolean {
  if (isDefaultValue(declaration, value)) return true;
  switch (formOf(value)) {
    case 'raw':
      return parsesAs(value, reading.typeOf(declaration));
    case 'reference':
      return acceptsTarget(declaration, referenceTarget(value));
    case 'expression':
      return false;
  }
}

function acceptsTarget(declaration: PropertyDeclaration, target: string | null): boolean {
  const targets = target === null ? undefined : model.byName.get(target);
  if (target === null || targets === undefined || refersTo(target, declaration.name, currentValuesOf)) return false;
  return fitsTarget(reading.typeOf(declaration), targets.map(reading.typeOf));
}

function detachedValue(declaration: PropertyDeclaration): string | null {
  const value = currentValueOf(declaration);
  if (formOf(value) === 'raw' || reading.placementOf(declaration) === null) return null;
  const target = referenceTarget(value);
  const inEffect = target === null ? null : reading.targetInEffect(declaration, target);
  const targetValue = inEffect === null ? null : currentValueOf(inEffect);
  if (targetValue !== null && formOf(targetValue) === 'raw') return targetValue;
  return resolvedValue(declaration, value);
}

function applyValue(declaration: PropertyDeclaration, value: string): void {
  appliedValues.set(declaration.id, value);
  showOnPage(declaration, value);
  reading = reading.withChangedValues();
}

function describeDeclaration(declaration: PropertyDeclaration, value: string, changed: boolean): PropertyEntry {
  const target = referenceTarget(value);
  return {
    kind: 'property',
    id: declaration.id,
    name: declaration.name,
    context: declaration.context,
    type: reading.typeOf(declaration),
    value,
    defaultValue: declaration.defaultValue,
    changed,
    editable: declaration.source !== null,
    location: declaration.location,
    presence: presenceOf(declaration),
    form: formOf(value),
    target,
    resolved: resolvedValue(declaration, value),
    targetInEffect: target === null ? null : (reading.targetInEffect(declaration, target)?.id ?? null),
    targetDeclarations: target === null ? [] : (model.byName.get(target) ?? []).map((candidate) => candidate.id),
  };
}

function presenceOf(declaration: PropertyDeclaration): Presence {
  if (reading.placementOf(declaration) !== null) return 'applied';
  return declaration.claims.length === 0 ? 'absent' : 'inactive';
}

function resolvedValue(declaration: PropertyDeclaration, value: string): string | null {
  const target = referenceTarget(value);
  if (target !== null && !model.byName.has(target)) return null;
  return reading.resolutionOf(declaration)?.resolved ?? null;
}

function currentValueOf(declaration: PropertyDeclaration): string {
  return appliedValues.get(declaration.id) ?? declaration.defaultValue;
}

function currentValuesOf(name: string): readonly string[] {
  return (model.byName.get(name) ?? []).map(currentValueOf);
}

function saveCandidate(declaration: PropertyDeclaration, value: unknown): SaveCandidate {
  if (declaration.source === null || declaration.location === null || typeof value !== 'string')
    return { ok: false, reason: READ_ONLY_REASON };
  const { id, name, context, value: loadedDefault } = declaration.source;
  return {
    ok: true,
    value: { kind: 'property', id, name, context, location: declaration.location, value, loadedDefault },
  };
}
