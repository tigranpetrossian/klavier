import type { SaveResponse, SaveValue } from '../shared/save-protocol';
import { batch } from './graph';
import { clonePlain, deepEqual } from './plain-data';
import { reportWarning } from './problems';
import {
  closeStep,
  EMPTY_HISTORY,
  nextRedoIds,
  nextUndoIds,
  parseStoredHistory,
  recordEdit,
  recordStep,
  takeRedo,
  takeUndo,
  type History,
} from './session-history';
import { requestSave, saveOutcome, type SavePlan } from './session-save';
import { guardStorage } from './session-storage';
import type { SaveState, SkippedValue, SourceLocation, TunableEntry, TuningStorage, ValueChange } from './value-types';

export type ValueAdapter = {
  readonly id: string;
  readonly defaultValue: unknown;
  readonly location: SourceLocation | null;
  readonly editable: boolean;
  isDefault(value: unknown): boolean;
  fits(value: unknown): boolean;
  apply(value: unknown): void;
  describe(value: unknown, changed: boolean): TunableEntry;
  saveValue(value: unknown): SaveCandidate;
};

export type SaveCandidate = { ok: true; value: SaveValue } | { ok: false; reason: string };

export type SessionState = {
  readonly changedCount: number;
  readonly undoIds: readonly string[] | null;
  readonly redoIds: readonly string[] | null;
  readonly saveState: SaveState;
};

type Snapshot = {
  readonly version: number;
  readonly entries: readonly TunableEntry[];
  readonly byId: ReadonlyMap<string, TunableEntry>;
  readonly session: SessionState;
};

type ValueWrite = { readonly id: string; readonly value: unknown };

type Session = { readonly storage: TuningStorage; starts: number };

const IDLE: SaveState = { status: 'idle' };
const SAVING: SaveState = { status: 'saving' };
const SAVED_STATE_DURATION_MS = 2000;
const NOTHING_SAVED: SaveResponse = { ok: true, saved: [], skipped: [] };

const adapters = new Map<string, ValueAdapter>();
const overrides = new Map<string, unknown>();
const previews = new Map<string, unknown>();
const listeners = new Set<() => void>();
let history: History = EMPTY_HISTORY;
let saveState: SaveState = IDLE;
let session: Session | null = null;
let version = 0;
let snapshot: Snapshot | null = null;
let notifyQueued = false;

export function registerValues(registered: readonly ValueAdapter[]): void {
  if (registered.length === 0) return;
  for (const adapter of registered) {
    settleOverride(adapter);
    previews.delete(adapter.id);
    adapters.set(adapter.id, adapter);
  }
  batch(() => {
    for (const adapter of registered) adapter.apply(effectiveValue(adapter));
  });
  storeOverrides();
  version++;
  notifyLater();
}

export function unregisterValues(ids: readonly string[]): void {
  for (const id of ids) previews.delete(id);
  const removed = ids.filter((id) => adapters.delete(id));
  if (removed.length === 0) return;
  version++;
  notifyLater();
}

export function refreshValues(): void {
  const shown = snapshot;
  version++;
  const refreshed = currentSnapshot();
  if (shown === null || refreshed.entries !== shown.entries || refreshed.session !== shown.session) notifyLater();
}

export function setValue(id: string, value: unknown): boolean {
  const adapter = adapters.get(id);
  if (!adapter?.editable || !adapter.fits(value)) return false;
  endPreview(id);
  const before = effectiveValue(adapter);
  if (deepEqual(before, value)) return true;
  commit(recordEdit(history, { id, before: clonePlain(before), after: clonePlain(value) }), [{ id, value }]);
  return true;
}

export function previewValue(id: string, value: unknown): boolean {
  const adapter = adapters.get(id);
  if (!adapter?.editable || !adapter.fits(value)) return false;
  const shown = clonePlain(value);
  previews.set(id, shown);
  batch(() => adapter.apply(shown));
  return true;
}

export function endPreview(id: string): void {
  const adapter = adapters.get(id);
  if (!previews.delete(id) || !adapter) return;
  batch(() => adapter.apply(effectiveValue(adapter)));
}

export function resetValue(id: string): boolean {
  const adapter = adapters.get(id);
  if (!adapter?.editable) return false;
  endPreview(id);
  const changes = overrides.has(id) ? [resetChange(adapter)] : [];
  commit(recordStep(history, changes), changes.map(toAfterWrite));
  return true;
}

export function resetAllValues(): void {
  const changes = [...adapters.values()]
    .filter((adapter) => adapter.editable && overrides.has(adapter.id))
    .map(resetChange);
  commit(recordStep(history, changes), changes.map(toAfterWrite));
}

export function undoStep(): void {
  const turn = takeUndo(history);
  const writes = (turn.step?.changes ?? []).toReversed().map((change) => ({ id: change.id, value: change.before }));
  commit(
    turn.history,
    writes.filter((write) => fitsOrWarn(write, 'undo'))
  );
}

export function redoStep(): void {
  const turn = takeRedo(history);
  const writes = (turn.step?.changes ?? []).map(toAfterWrite);
  commit(
    turn.history,
    writes.filter((write) => fitsOrWarn(write, 'redo'))
  );
}

export async function saveValues(): Promise<void> {
  if (saveState.status === 'saving') return;
  closeOpenStep();
  const plan = planSave();
  updateSaveState(SAVING);
  const response = plan.values.length === 0 ? NOTHING_SAVED : await requestSave({ values: plan.values });
  finishSave(saveOutcome(plan, response));
}

export function closeOpenStep(): void {
  if (history.open !== null) commit(closeStep(history), []);
}

export function startSession(storage: TuningStorage): () => void {
  if (session) session.starts++;
  else {
    const guarded = guardStorage(storage);
    session = { storage: guarded, starts: 1 };
    restoreSession(guarded);
  }
  return stopSession;
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function storeEntries(): readonly TunableEntry[] {
  return currentSnapshot().entries;
}

export function storeEntry(id: string): TunableEntry | undefined {
  return currentSnapshot().byId.get(id);
}

export function sessionState(): SessionState {
  return currentSnapshot().session;
}

function stopSession(): void {
  if (!session) return;
  session.starts--;
  if (session.starts > 0) return;
  session = null;
}

function restoreSession(storage: TuningStorage): void {
  const storedOverrides = storage.readOverrides();
  const storedHistory = parseStoredHistory(storage.readHistory());
  batch(() => {
    for (const [id, value] of Object.entries(storedOverrides)) restoreOverride(id, value);
  });
  if (storedHistory) history = { ...history, ...storedHistory };
  storeOverrides();
  storeHistory();
  version++;
  notify();
}

function commit(next: History, writes: readonly ValueWrite[]): void {
  batch(() => {
    for (const write of writes) writeValue(write.id, write.value);
  });
  const closedStepsChanged = next.undo !== history.undo || next.redo !== history.redo;
  history = next;
  if (writes.length > 0) storeOverrides();
  if (closedStepsChanged) storeHistory();
  version++;
  notify();
}

function planSave(): SavePlan {
  const values: SaveValue[] = [];
  const skipped: SkippedValue[] = [];
  for (const adapter of adapters.values()) {
    if (!overrides.has(adapter.id)) continue;
    const candidate = adapter.saveValue(overrides.get(adapter.id));
    if (candidate.ok) values.push(candidate.value);
    else skipped.push({ id: adapter.id, location: adapter.location, reason: candidate.reason });
  }
  return { values, skipped };
}

function finishSave(outcome: SaveState): void {
  updateSaveState(outcome);
  if (outcome.status !== 'saved' || outcome.skipped.length > 0) return;
  setTimeout(() => {
    if (saveState === outcome) updateSaveState(IDLE);
  }, SAVED_STATE_DURATION_MS);
}

function updateSaveState(next: SaveState): void {
  saveState = next;
  version++;
  notify();
}

function storeOverrides(): void {
  session?.storage.writeOverrides(Object.fromEntries(overrides));
}

function storeHistory(): void {
  session?.storage.writeHistory({ undo: history.undo, redo: history.redo });
}

function restoreOverride(id: string, value: unknown): void {
  const adapter = adapters.get(id);
  if (adapter && !adapter.fits(value)) reportDroppedOverride(adapter);
  else writeValue(id, value);
}

function writeValue(id: string, value: unknown): void {
  previews.delete(id);
  const adapter = adapters.get(id);
  if (adapter?.isDefault(value)) {
    overrides.delete(id);
    adapter.apply(adapter.defaultValue);
    return;
  }
  const override = clonePlain(value);
  overrides.set(id, override);
  adapter?.apply(override);
}

function resetChange(adapter: ValueAdapter): ValueChange {
  return { id: adapter.id, before: clonePlain(overrides.get(adapter.id)), after: clonePlain(adapter.defaultValue) };
}

function toAfterWrite(change: ValueChange): ValueWrite {
  return { id: change.id, value: change.after };
}

function fitsOrWarn(write: ValueWrite, action: 'undo' | 'redo'): boolean {
  const adapter = adapters.get(write.id);
  if (!adapter || adapter.fits(write.value)) return true;
  reportWarning(
    `Skipped the ${action} of '${write.id}'${describeLocation(adapter.location)}: the value no longer fits its type.`
  );
  return false;
}

function settleOverride(adapter: ValueAdapter): void {
  if (!overrides.has(adapter.id)) return;
  const override = overrides.get(adapter.id);
  if (!adapter.fits(override)) {
    overrides.delete(adapter.id);
    reportDroppedOverride(adapter);
  } else if (adapter.isDefault(override)) {
    overrides.delete(adapter.id);
  }
}

function reportDroppedOverride(adapter: ValueAdapter): void {
  reportWarning(
    `Dropped the override of '${adapter.id}'${describeLocation(adapter.location)}: it no longer fits its type.`
  );
}

function effectiveValue(adapter: ValueAdapter): unknown {
  return overrides.has(adapter.id) ? overrides.get(adapter.id) : adapter.defaultValue;
}

function currentSnapshot(): Snapshot {
  if (snapshot?.version === version) return snapshot;
  const previous = snapshot;
  const described = [...adapters.values()].map((adapter) =>
    adapter.describe(effectiveValue(adapter), overrides.has(adapter.id))
  );
  const entries = sharedEntries(previous?.entries ?? [], described);
  const session: SessionState = {
    changedCount: entries.filter((entry) => entry.changed).length,
    undoIds: nextUndoIds(history),
    redoIds: nextRedoIds(history),
    saveState,
  };
  snapshot = {
    version,
    entries,
    byId:
      previous !== null && entries === previous.entries
        ? previous.byId
        : new Map(entries.map((entry) => [entry.id, entry])),
    session: previous !== null && deepEqual(previous.session, session) ? previous.session : session,
  };
  return snapshot;
}

function sharedEntries(previous: readonly TunableEntry[], described: readonly TunableEntry[]): readonly TunableEntry[] {
  const previousById = new Map(previous.map((entry) => [entry.id, entry]));
  const entries = described.map((entry) => {
    const shown = previousById.get(entry.id);
    return shown !== undefined && deepEqual(shown, entry) ? shown : entry;
  });
  const unchanged = entries.length === previous.length && entries.every((entry, index) => entry === previous[index]);
  return unchanged ? previous : entries;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function notifyLater(): void {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    notify();
  });
}

function describeLocation(location: SourceLocation | null): string {
  return location ? ` at ${location.file}:${location.line}` : '';
}
