import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { clearTuning, renderNumber, renderSession, silenceConsole, tunerProblem } from '../support/harness';
import { Studio } from './studio/studio';
import { createMemoryStorage, type TuningStorage } from '@/lib/tuner/react';

beforeEach(clearTuning);

afterEach(() => {
  vi.restoreAllMocks();
});

test('stored overrides apply when the tuning session starts, not before, and are not recorded in history', async () => {
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'studio.width': 400, 'studio.tone': 'dark' });
  const screen = await render(<Studio />);
  const textBeforeStart = screen.getByTestId('studio').element().textContent;

  const session = await renderSession(storage);

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('dark 400 16');
  expect([textBeforeStart, session.result.current.changedCount, session.result.current.undoIds]).toEqual([
    'light 320 16',
    2,
    null,
  ]);
});

test('a stored override for a value that is not registered yet applies when the value appears', async () => {
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'late.radius': 9 });
  await renderSession(storage);

  const { LATE_RADIUS } = await import('./studio/late-config');
  const radius = await renderNumber('late.radius');

  expect([LATE_RADIUS, radius.result.current.changed]).toEqual([9, true]);
});

test('a stored override that does not fit its type is dropped with a warning', async () => {
  const warnings = silenceConsole('warn');
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'studio.gap': 'wide' });

  await renderSession(storage);
  const gap = await renderNumber('studio.gap');

  expect(warnings).toHaveBeenCalledWith(
    tunerProblem('studio.gap', 'src/lib/tuner/browser-tests/session/studio/studio-config.ts:4')
  );
  expect([gap.result.current.value, gap.result.current.changed]).toEqual([16, false]);
});

test('a stored override equal to its default is discarded', async () => {
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'studio.width': 320 });

  const session = await renderSession(storage);
  const width = await renderNumber('studio.width');

  expect([width.result.current.changed, session.result.current.changedCount]).toEqual([false, 0]);
});

test('overrides are stored by id, keeping stored overrides of values that are not on this page', async () => {
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'elsewhere.size': 3, 'studio.gap': 'wide', 'studio.width': 320 });
  await renderSession(storage);
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');

  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  await gap.act(() => gap.result.current.onReset());

  expect(storage.readOverrides()).toEqual({ 'elsewhere.size': 3, 'studio.width': 400 });
});

test('history is stored whenever a step closes and after each undo or redo', async () => {
  const storage = createMemoryStorage();
  const session = await renderSession(storage);
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  const stored: unknown[] = [];

  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  stored.push(storage.readHistory());
  await session.act(() => session.result.current.undo());
  stored.push(storage.readHistory());
  await session.act(() => session.result.current.redo());
  stored.push(storage.readHistory());

  const widthStep = { changes: [{ id: 'studio.width', before: 320, after: 400 }] };
  const gapStep = { changes: [{ id: 'studio.gap', before: 16, after: 20 }] };
  expect(stored).toEqual([
    { undo: [widthStep], redo: [] },
    { undo: [widthStep], redo: [gapStep] },
    { undo: [widthStep, gapStep], redo: [] },
  ]);
});

test('stored history lets undo and redo continue where the last page left off', async () => {
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'studio.width': 400 });
  storage.writeHistory({
    undo: [{ changes: [{ id: 'studio.width', before: 320, after: 400 }] }],
    redo: [{ changes: [{ id: 'studio.gap', before: 16, after: 24 }] }],
  });
  const screen = await render(<Studio />);
  const session = await renderSession(storage);
  const restoredIds = [session.result.current.undoIds, session.result.current.redoIds];

  await session.act(() => session.result.current.undo());
  await session.act(() => session.result.current.redo());
  await session.act(() => session.result.current.redo());

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 400 24');
  expect(restoredIds).toEqual([['studio.width'], ['studio.gap']]);
});

test.each([
  ['not an object', 'undo everything'],
  ['missing redo', { undo: [] }],
  ['a step without changes', { undo: [{ changes: [] }], redo: [] }],
  ['a change without a before value', { undo: [{ changes: [{ id: 'studio.width', after: 400 }] }], redo: [] }],
])('stored history that is malformed (%s) is ignored', async (_, malformed) => {
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  const corrupted: TuningStorage = {
    readOverrides: () => ({ 'studio.width': 400, 'studio.gap': 20 }),
    writeOverrides: () => {},
    readHistory: () => malformed,
    writeHistory: () => {},
  };

  const session = await renderSession(corrupted);
  await session.act(() => session.result.current.undo());
  await session.act(() => session.result.current.undo());

  expect([width.result.current.value, gap.result.current.value]).toEqual([320, 16]);
});
