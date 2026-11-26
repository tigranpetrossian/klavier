import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { detachProperty, pointProperty, propertyTargets, startPropertyTuning } from './runtime/custom-properties';
import { propertyId } from './runtime/declaration-model';
import {
  closeOpenStep,
  endPreview,
  previewValue,
  redoStep,
  resetAllValues,
  resetValue,
  saveValues,
  sessionState,
  setValue,
  startSession,
  storeEntries,
  storeEntry,
  subscribeToStore,
  undoStep,
  type SessionState,
} from './runtime/session-store';
import { createBrowserStorage } from './runtime/session-storage';
import { watchStepBoundaries } from './runtime/step-boundaries';
import type { ConstantEntry, PropertyEntry, SaveState, TunableEntry, TuningStorage } from './runtime/value-types';

export type { Color } from './tunable';
export type { ColorModel, ConstantType } from './shared/constant-type';
export type {
  ConstantEntry,
  HistoryStep,
  Presence,
  PropertyEntry,
  PropertyType,
  SaveState,
  SkippedValue,
  SourceLocation,
  TunableEntry,
  TuningStorage,
  ValueChange,
} from './runtime/value-types';
export { createBrowserStorage, createMemoryStorage } from './runtime/session-storage';

export type ValueControl<T> = {
  value: T;
  defaultValue: T;
  changed: boolean;
  disabled: boolean;
  onValueChange(value: T): boolean;
  onPreviewChange(value: T | null): boolean;
  onReset(): void;
};

export type ConstantControl<T> = ValueControl<T> & { entry: ConstantEntry | null };

export type PropertyControl<T = string> = ValueControl<T> & {
  entry: PropertyEntry | null;
  targets: readonly string[];
  pointTo(name: string): boolean;
  detach(): boolean;
};

export type PropertyCodec<T> = {
  empty: T;
  parse(css: string): T | null;
  format(value: T, current: string): string;
};

export type PropertyOptions = { context?: string };

export type TuningSessionControls = {
  changedCount: number;
  undoIds: readonly string[] | null;
  redoIds: readonly string[] | null;
  saveState: SaveState;
  undo(): void;
  redo(): void;
  commitUndo(): void;
  resetAll(): void;
  save(): Promise<void>;
};

const NO_ENTRIES: readonly TunableEntry[] = [];
const NO_TARGETS: readonly string[] = [];
const DEFAULT_CONTEXT = ':root';
const TEXT: PropertyCodec<string> = { empty: '', parse: (css) => css, format: (value) => value };
const SERVER_SESSION_STATE: SessionState = {
  changedCount: 0,
  undoIds: null,
  redoIds: null,
  saveState: { status: 'idle' },
};

export function useTunable<T>(id: string, check: (value: unknown) => value is T, fallback: T): ConstantControl<T> {
  const entry = useSyncExternalStore(subscribeToStore, () => storeEntry(id), noEntry);
  return useMemo(() => constantControl(entry, check, fallback), [entry, check, fallback]);
}

export function useProperty(name: string, options?: PropertyOptions & { codec?: never }): PropertyControl;
export function useProperty<T>(
  name: string,
  options: PropertyOptions & { codec: PropertyCodec<T> }
): PropertyControl<T>;
export function useProperty<T>(
  name: string,
  { context = DEFAULT_CONTEXT, codec }: PropertyOptions & { codec?: PropertyCodec<T> } = {}
): PropertyControl<T> | PropertyControl {
  const entries = useTunables();
  return useMemo(() => {
    const entry = entries.find((candidate) => candidate.id === propertyId(name, context));
    return codec === undefined ? propertyControl(entry, TEXT) : propertyControl(entry, codec);
  }, [entries, name, context, codec]);
}

export function useTunables(): readonly TunableEntry[] {
  return useSyncExternalStore(subscribeToStore, storeEntries, () => NO_ENTRIES);
}

export type TuningSessionOptions = { storage?: TuningStorage };

export function useTuningSession({ storage }: TuningSessionOptions = {}): TuningSessionControls {
  const state = useSyncExternalStore(subscribeToStore, sessionState, serverSessionState);
  const [chosenStorage] = useState(() => storage ?? createBrowserStorage());
  useEffect(() => {
    const stopSession = startSession(chosenStorage);
    const stopPropertyTuning = startPropertyTuning();
    const stopStepBoundaries = watchStepBoundaries();
    return () => {
      stopStepBoundaries();
      stopPropertyTuning();
      stopSession();
    };
  }, [chosenStorage]);
  return useMemo(
    () => ({
      ...state,
      undo: undoStep,
      redo: redoStep,
      commitUndo: closeOpenStep,
      resetAll: resetAllValues,
      save: saveValues,
    }),
    [state]
  );
}

function constantControl<T>(
  entry: TunableEntry | undefined,
  check: (value: unknown) => value is T,
  fallback: T
): ConstantControl<T> {
  if (entry?.kind !== 'constant' || !check(entry.value) || !check(entry.defaultValue)) {
    return { ...missingControl(fallback), entry: null };
  }
  return {
    entry,
    value: entry.value,
    defaultValue: entry.defaultValue,
    changed: entry.changed,
    disabled: false,
    ...valueHandlers<T>(entry.id, (next) => next),
  };
}

function propertyControl<T>(entry: TunableEntry | undefined, codec: PropertyCodec<T>): PropertyControl<T> {
  if (entry?.kind !== 'property') {
    return { ...missingControl(codec.empty), entry: null, targets: NO_TARGETS, pointTo: refuse, detach: refuse };
  }
  const { id, changed, editable } = entry;
  const value = shownValue(entry, codec);
  return {
    entry,
    value,
    defaultValue: codec.parse(entry.defaultValue) ?? value,
    changed,
    disabled: !editable,
    ...valueHandlers<T>(id, (next) => codec.format(next, entry.value)),
    targets: propertyTargets(id),
    pointTo: (name) => pointProperty(id, name),
    detach: () => detachProperty(id),
  };
}

function shownValue<T>(entry: PropertyEntry, codec: PropertyCodec<T>): T {
  const resolved = entry.resolved === null ? null : codec.parse(entry.resolved);
  return codec.parse(entry.value) ?? resolved ?? codec.parse(entry.defaultValue) ?? codec.empty;
}

function valueHandlers<T>(
  id: string,
  write: (value: T) => unknown
): Pick<ValueControl<T>, 'onValueChange' | 'onPreviewChange' | 'onReset'> {
  return {
    onValueChange: (next) => setValue(id, write(next)),
    onPreviewChange: (next) => (next === null ? endPreviewOf(id) : previewValue(id, write(next))),
    onReset: () => {
      resetValue(id);
    },
  };
}

function missingControl<T>(fallback: T): ValueControl<T> {
  return {
    value: fallback,
    defaultValue: fallback,
    changed: false,
    disabled: true,
    onValueChange: refuse,
    onPreviewChange: refuse,
    onReset: () => {},
  };
}

function endPreviewOf(id: string): boolean {
  endPreview(id);
  return true;
}

function refuse(): boolean {
  return false;
}

function noEntry(): undefined {
  return undefined;
}

function serverSessionState(): SessionState {
  return SERVER_SESSION_STATE;
}
