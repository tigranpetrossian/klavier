import { closeOpenStep, storeEntries } from './session-store';

export type InputSignal = { kind: 'pointer' } | { kind: 'key'; key: string };

export type Boundary = { closes: boolean; afterNudge: boolean };

type Watcher = { stop(): void; starts: number };

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Alt', 'Control', 'Meta', 'CapsLock', 'AltGraph']);
const NUDGE_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);
const POINTER: InputSignal = { kind: 'pointer' };

let watcher: Watcher | null = null;

export function stepBoundary(signal: InputSignal, afterNudge: boolean): Boundary {
  if (signal.kind === 'pointer') return { closes: true, afterNudge: false };
  if (MODIFIER_KEYS.has(signal.key)) return { closes: false, afterNudge };
  if (NUDGE_KEYS.has(signal.key)) return { closes: !afterNudge, afterNudge: true };
  return { closes: true, afterNudge: false };
}

export function watchStepBoundaries(): () => void {
  if (watcher) watcher.starts++;
  else watcher = { stop: listenForBoundaries(), starts: 1 };
  return stopWatching;
}

function stopWatching(): void {
  if (!watcher) return;
  watcher.starts--;
  if (watcher.starts > 0) return;
  watcher.stop();
  watcher = null;
}

function listenForBoundaries(): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const capture = { capture: true, signal };
  let afterNudge = false;
  let entriesBeforeFocusOut = storeEntries();
  const handle = (input: InputSignal) => {
    const boundary = stepBoundary(input, afterNudge);
    afterNudge = boundary.afterNudge;
    if (boundary.closes) closeOpenStep();
  };
  window.addEventListener('pointerdown', () => handle(POINTER), capture);
  window.addEventListener('keydown', (event) => handle({ kind: 'key', key: event.key }), capture);
  window.addEventListener('focusout', () => (entriesBeforeFocusOut = storeEntries()), capture);
  window.addEventListener('focusout', () => closeStepOfEditOnBlur(entriesBeforeFocusOut), { signal });
  window.addEventListener('pagehide', closeOpenStep, capture);
  return () => controller.abort();
}

function closeStepOfEditOnBlur(entriesBeforeFocusOut: readonly unknown[]): void {
  if (storeEntries() !== entriesBeforeFocusOut) closeOpenStep();
}
