import { deepEqual, isPlainObject } from './plain-data';
import type { HistoryStep, ValueChange } from './value-types';

export type StoredHistory = { readonly undo: readonly HistoryStep[]; readonly redo: readonly HistoryStep[] };

export type History = StoredHistory & { readonly open: ValueChange | null };

export type Turn = { readonly history: History; readonly step: HistoryStep | null };

const HISTORY_LIMIT = 200;
const NO_STEPS: readonly HistoryStep[] = [];

export const EMPTY_HISTORY: History = { undo: NO_STEPS, redo: NO_STEPS, open: null };

export function recordEdit(history: History, change: ValueChange): History {
  if (history.open?.id === change.id)
    return { ...history, redo: NO_STEPS, open: { ...history.open, after: change.after } };
  return { ...closeStep(history), redo: NO_STEPS, open: change };
}

export function recordStep(history: History, changes: readonly ValueChange[]): History {
  const closed = closeStep(history);
  const kept = changes.filter(isRealChange);
  return kept.length === 0 ? closed : { ...closed, undo: limited([...closed.undo, { changes: kept }]), redo: NO_STEPS };
}

export function closeStep(history: History): History {
  if (history.open === null) return history;
  const undo = isRealChange(history.open) ? limited([...history.undo, { changes: [history.open] }]) : history.undo;
  return { ...history, undo, open: null };
}

export function takeUndo(history: History): Turn {
  const closed = closeStep(history);
  const step = closed.undo.at(-1);
  if (!step) return { history: closed, step: null };
  return { history: { undo: closed.undo.slice(0, -1), redo: [...closed.redo, step], open: null }, step };
}

export function takeRedo(history: History): Turn {
  const closed = closeStep(history);
  const step = closed.redo.at(-1);
  if (!step) return { history: closed, step: null };
  return { history: { undo: limited([...closed.undo, step]), redo: closed.redo.slice(0, -1), open: null }, step };
}

export function nextUndoIds(history: History): readonly string[] | null {
  return stepIds(closeStep(history).undo.at(-1));
}

export function nextRedoIds(history: History): readonly string[] | null {
  return stepIds(closeStep(history).redo.at(-1));
}

export function parseStoredHistory(raw: unknown): StoredHistory | null {
  if (!isPlainObject(raw) || !isStepList(raw.undo) || !isStepList(raw.redo)) return null;
  return { undo: limited(raw.undo), redo: raw.redo };
}

function isRealChange(change: ValueChange): boolean {
  return !deepEqual(change.before, change.after);
}

function limited(steps: readonly HistoryStep[]): readonly HistoryStep[] {
  return steps.length > HISTORY_LIMIT ? steps.slice(-HISTORY_LIMIT) : steps;
}

function stepIds(step: HistoryStep | undefined): readonly string[] | null {
  return step ? step.changes.map((change) => change.id) : null;
}

function isStepList(value: unknown): value is HistoryStep[] {
  return Array.isArray(value) && value.every(isStep);
}

function isStep(value: unknown): value is HistoryStep {
  return (
    isPlainObject(value) && Array.isArray(value.changes) && value.changes.length > 0 && value.changes.every(isChange)
  );
}

function isChange(value: unknown): value is ValueChange {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    Object.hasOwn(value, 'before') &&
    Object.hasOwn(value, 'after')
  );
}
