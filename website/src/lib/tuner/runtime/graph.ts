import { deepEqual } from './plain-data';
import { reportError } from './problems';

export type Deps = Map<Cell, number>;

export type World = 'defaults' | 'tuned';

export type Frame = {
  readonly deps: Deps | null;
  readonly initialDeps: Deps | null;
  readonly rendering: boolean;
  readonly world: World;
};

export type Subscriber = { readonly kind: 'subscriber'; readonly onChange: () => void };

type CellCore = { value: unknown; version: number; readonly observers: Set<Observer> };

type SourceCell = CellCore & { readonly kind: 'source'; readonly id: string; defaultValue: unknown };

type DefaultSnapshot = { readonly epoch: number; readonly value: unknown };

type DerivedCell = CellCore & {
  readonly kind: 'derived';
  readonly key: string;
  readonly setters: ((value: unknown) => void)[];
  init: () => unknown;
  deps: Deps;
  state: 'clean' | 'check';
  computing: boolean;
  defaults: DefaultSnapshot | null;
};

export type Cell = SourceCell | DerivedCell;

type Observer = DerivedCell | Subscriber;

type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown };

const STALE_VERSION = -1;
const DEFAULTS_FRAME: Frame = { deps: null, initialDeps: null, rendering: false, world: 'defaults' };

const sources = new Map<string, SourceCell>();
const derivedCells = new Map<string, DerivedCell>();
const tunedSources = new Set<SourceCell>();
const frames: Frame[] = [];
const markedCells = new Set<DerivedCell>();
const markedSubscribers = new Set<Subscriber>();
let defaultsEpoch = 0;
let batchDepth = 0;
let flushing = false;
let flushQueued = false;

export function defineCell(key: string, init: () => unknown, setter: (value: unknown) => void): unknown {
  const existing = derivedCells.get(key);
  if (existing) return redefineCell(existing, init, setter);
  const cell: DerivedCell = {
    kind: 'derived',
    key,
    value: undefined,
    version: 0,
    observers: new Set(),
    setters: [setter],
    init,
    deps: new Map(),
    state: 'clean',
    computing: false,
    defaults: null,
  };
  cell.value = runInFrame(trackingFrame(cell.deps), init);
  for (const dep of cell.deps.keys()) dep.observers.add(cell);
  rememberDefault(cell);
  derivedCells.set(key, cell);
  return cell.value;
}

export function readCell(key: string, binding: unknown): unknown {
  const cell = derivedCells.get(key);
  if (!cell) return binding;
  refresh(cell);
  return readInWorld(cell);
}

export function defineSource(id: string, defaultValue: unknown): void {
  const cell = sources.get(id);
  if (!cell) {
    sources.set(id, { kind: 'source', id, value: defaultValue, defaultValue, version: 0, observers: new Set() });
    return;
  }
  if (deepEqual(cell.defaultValue, defaultValue)) return;
  cell.defaultValue = defaultValue;
  defaultsEpoch++;
  noteTuning(cell);
}

export function readSource(id: string): unknown {
  const cell = sources.get(id);
  return cell ? readInWorld(cell) : undefined;
}

export function writeSource(id: string, value: unknown): void {
  const cell = sources.get(id);
  if (!cell || deepEqual(cell.value, value)) return;
  cell.value = value;
  cell.version++;
  noteTuning(cell);
  mark(cell);
  scheduleFlush();
}

export function currentWorld(): World {
  return tunedSources.size > 0 ? 'tuned' : 'defaults';
}

export function batch(run: () => void): void {
  batchDepth++;
  try {
    run();
  } finally {
    batchDepth--;
    scheduleFlush();
  }
}

export function runInFrame<T>(frame: Frame, run: () => T): T {
  frames.push(frame);
  try {
    return run();
  } finally {
    popFrame(frame);
  }
}

export function pushFrame(frame: Frame): void {
  frames.push(frame);
}

export function popFrame(frame: Frame): void {
  const index = frames.lastIndexOf(frame);
  if (index >= 0) frames.length = index;
}

export function topFrame(): Frame | undefined {
  return frames.at(-1);
}

export function trackingFrame(deps: Deps): Frame {
  return { deps, initialDeps: null, rendering: false, world: 'tuned' };
}

export function changedSince(deps: ReadonlyMap<Cell, number>): boolean {
  for (const [dep, seen] of deps) {
    if (dep.kind === 'derived') refresh(dep);
    if (dep.version !== seen) return true;
  }
  return false;
}

export function subscribe(subscriber: Subscriber, deps: ReadonlyMap<Cell, number>): void {
  for (const dep of deps.keys()) dep.observers.add(subscriber);
}

export function unsubscribe(subscriber: Subscriber, deps: ReadonlyMap<Cell, number>): void {
  for (const dep of deps.keys()) dep.observers.delete(subscriber);
}

function redefineCell(cell: DerivedCell, init: () => unknown, setter: (value: unknown) => void): unknown {
  cell.init = init;
  defaultsEpoch++;
  batch(() => recompute(cell));
  cell.setters.push(setter);
  return cell.value;
}

function readInWorld(cell: Cell): unknown {
  const frame = topFrame();
  if (frame?.world !== 'defaults' || tunedSources.size === 0) {
    track(frame, cell, cell.version);
    return cell.value;
  }
  const value = defaultValueOf(cell);
  track(frame, cell, isCurrentValue(cell, value) ? cell.version : STALE_VERSION);
  return value;
}

function track(frame: Frame | undefined, cell: Cell, version: number): void {
  const deps = frame?.deps;
  if (deps && !deps.has(cell)) deps.set(cell, version);
}

function defaultValueOf(cell: Cell): unknown {
  if (cell.kind === 'source') return cell.defaultValue;
  if (cell.defaults?.epoch === defaultsEpoch) return cell.defaults.value;
  const outcome = attempt(() => runInFrame(DEFAULTS_FRAME, cell.init));
  const value = outcome.ok ? outcome.value : cell.value;
  cell.defaults = { epoch: defaultsEpoch, value };
  return value;
}

function rememberDefault(cell: DerivedCell): void {
  if ([...cell.deps.keys()].every(showsDefault)) cell.defaults = { epoch: defaultsEpoch, value: cell.value };
}

function showsDefault(cell: Cell): boolean {
  if (cell.kind === 'source') return !tunedSources.has(cell);
  return cell.defaults?.epoch === defaultsEpoch && Object.is(cell.defaults.value, cell.value);
}

function isCurrentValue(cell: Cell, value: unknown): boolean {
  return cell.kind === 'source' ? deepEqual(cell.value, value) : Object.is(cell.value, value);
}

function noteTuning(cell: SourceCell): void {
  if (deepEqual(cell.value, cell.defaultValue)) tunedSources.delete(cell);
  else tunedSources.add(cell);
}

function mark(cell: Cell): void {
  for (const observer of cell.observers) {
    if (observer.kind === 'subscriber') {
      markedSubscribers.add(observer);
    } else if (observer.state === 'clean') {
      observer.state = 'check';
      markedCells.add(observer);
      mark(observer);
    }
  }
}

function scheduleFlush(): void {
  if (batchDepth > 0 || flushing) return;
  if (!frames.some((frame) => frame.rendering)) {
    flush();
    return;
  }
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    flush();
  });
}

function flush(): void {
  flushing = true;
  try {
    while (markedCells.size > 0 || markedSubscribers.size > 0) {
      const cells = [...markedCells];
      markedCells.clear();
      for (const cell of cells) refresh(cell);
      const subscribers = [...markedSubscribers];
      markedSubscribers.clear();
      for (const subscriber of subscribers) subscriber.onChange();
    }
  } finally {
    flushing = false;
  }
}

function refresh(cell: DerivedCell): void {
  if (cell.state === 'clean' || cell.computing) return;
  for (const [dep, seen] of cell.deps) {
    if (dep.kind === 'derived') refresh(dep);
    if (dep.version !== seen) {
      recompute(cell);
      return;
    }
  }
  cell.state = 'clean';
}

function recompute(cell: DerivedCell): void {
  const previous = cell.deps;
  const next: Deps = new Map();
  cell.computing = true;
  const outcome = attempt(() => runInFrame(trackingFrame(next), cell.init));
  cell.computing = false;
  cell.deps = outcome.ok ? next : new Map([...previous, ...next]);
  relink(cell, previous);
  cell.state = 'clean';
  if (!outcome.ok) {
    reportError(`${cell.key} failed to recompute and keeps its last value.`, outcome.error);
    return;
  }
  const changed = !Object.is(outcome.value, cell.value);
  cell.value = outcome.value;
  rememberDefault(cell);
  if (!changed) return;
  cell.version++;
  for (const setter of cell.setters) setter(outcome.value);
  mark(cell);
  scheduleFlush();
}

function relink(cell: DerivedCell, previous: Deps): void {
  for (const dep of previous.keys()) if (!cell.deps.has(dep)) dep.observers.delete(cell);
  for (const dep of cell.deps.keys()) dep.observers.add(cell);
}

function attempt(run: () => unknown): Outcome {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { ok: false, error };
  }
}
