import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import {
  clearTuning,
  hotReload,
  renderNumber,
  renderSession,
  renderString,
  silenceConsole,
  tunerProblem,
} from '../support/harness';
import { Studio } from './studio/studio';
import { useTunables } from '@/lib/tuner/react';

beforeEach(clearTuning);

afterEach(() => {
  vi.restoreAllMocks();
});

test('repeated edits of one value are one step that undo reverts and redo reapplies', async () => {
  const screen = await render(<Studio />);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(330));
  await width.act(() => width.result.current.onValueChange(340));
  const undoIdsBeforeUndo = session.result.current.undoIds;

  await session.act(() => session.result.current.undo());
  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 320 16');
  const idsAfterUndo = [session.result.current.undoIds, session.result.current.redoIds];
  await session.act(() => session.result.current.redo());

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 340 16');
  expect([undoIdsBeforeUndo, ...idsAfterUndo]).toEqual([['studio.width'], null, ['studio.width']]);
});

test('an edit of another value closes the open step, so undo goes back one value at a time', async () => {
  const screen = await render(<Studio />);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  await width.act(() => width.result.current.onValueChange(410));
  const texts: (string | null)[] = [];

  for (let undo = 0; undo < 3; undo++) {
    await session.act(() => session.result.current.undo());
    texts.push(screen.getByTestId('studio').element().textContent);
  }

  expect(texts).toEqual(['light 400 20', 'light 400 16', 'light 320 16']);
  expect(session.result.current.undoIds).toBeNull();
});

test('reset is a closed step of its own, between the edits around it', async () => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await width.act(() => width.result.current.onReset());
  await width.act(() => width.result.current.onValueChange(500));
  const values: number[] = [];

  for (let undo = 0; undo < 3; undo++) {
    await session.act(() => session.result.current.undo());
    values.push(width.result.current.value);
  }

  expect(values).toEqual([320, 400, 320]);
  expect(session.result.current.undoIds).toBeNull();
});

test('reset all is one step that undo reverts for every value it reset', async () => {
  const screen = await render(<Studio />);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  await session.act(() => session.result.current.resetAll());
  const undoIds = session.result.current.undoIds;

  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 400 20');
  expect(undoIds).toEqual(['studio.width', 'studio.gap']);
});

test('a change that ends where it started is dropped when its step closes', async () => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await gap.act(() => gap.result.current.onValueChange(20));
  await gap.act(() => gap.result.current.onValueChange(16));
  await width.act(() => width.result.current.onValueChange(400));

  await session.act(() => session.result.current.undo());

  expect([width.result.current.value, session.result.current.undoIds]).toEqual([320, null]);
});

test('a new edit clears redo', async () => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await session.act(() => session.result.current.undo());
  const redoIdsAfterUndo = session.result.current.redoIds;

  await width.act(() => width.result.current.onValueChange(410));

  expect([redoIdsAfterUndo, session.result.current.redoIds]).toEqual([['studio.width'], null]);
});

test('undo and redo with nothing to undo or redo change nothing', async () => {
  const screen = await render(<Studio />);
  const session = await renderSession();

  await session.act(() => session.result.current.undo());
  await session.act(() => session.result.current.redo());

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 320 16');
  expect([session.result.current.undoIds, session.result.current.redoIds]).toEqual([null, null]);
});

test('undo skips a value that no longer fits its type, with a warning, and still moves through history', async () => {
  const warnings = silenceConsole('warn');
  await import('./studio/mood-config');
  const session = await renderSession();
  const mood = await renderString('studio.mood');
  await mood.act(() => mood.result.current.onValueChange('busy'));
  await mood.act(() => hotReload('session/studio/mood-config.ts', 'retyped'));
  warnings.mockClear();

  await session.act(() => session.result.current.undo());

  expect(warnings).toHaveBeenCalledWith(
    tunerProblem('studio.mood', 'src/lib/tuner/browser-tests/session/studio/mood-config.ts:3')
  );
  expect([mood.result.current.value, session.result.current.undoIds, session.result.current.redoIds]).toEqual([
    'quiet',
    null,
    ['studio.mood'],
  ]);
});

test('history keeps the latest 200 steps and drops the oldest', async () => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => {
    for (let edit = 1; edit <= 202; edit++) {
      if (edit % 2 === 1) width.result.current.onValueChange(320 + edit);
      else gap.result.current.onValueChange(16 + edit);
    }
  });

  await session.act(() => {
    for (let undo = 0; undo < 250; undo++) session.result.current.undo();
  });

  expect([width.result.current.value, gap.result.current.value, session.result.current.undoIds]).toEqual([
    321,
    18,
    null,
  ]);
});

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);
const STUDIO_IDS = ['studio.width', 'studio.gap', 'studio.tone'];

test.each(SEEDS)(
  'after generated edits, resets and step closes (seed %i), undoing everything restores the defaults and redoing everything restores the edits',
  async (seed) => {
    const random = seededRandom(seed);
    const session = await renderSession();
    const width = await renderNumber('studio.width');
    const gap = await renderNumber('studio.gap');
    const tone = await renderString('studio.tone');
    const tunables = await renderHook(() => useTunables());
    const studioValues = () =>
      Object.fromEntries(
        tunables.result.current.filter((entry) => STUDIO_IDS.includes(entry.id)).map((entry) => [entry.id, entry.value])
      );
    const operations = [
      () => width.result.current.onValueChange(pick(random, [300, 310, 320, 330])),
      () => gap.result.current.onValueChange(pick(random, [12, 16, 20])),
      () => tone.result.current.onValueChange(pick(random, ['light', 'dark'])),
      () => width.result.current.onReset(),
      () => session.result.current.resetAll(),
      () => session.result.current.commitUndo(),
    ];

    await session.act(() => {
      for (let operation = 0; operation < 40; operation++) pick(random, operations)();
    });
    const edited = studioValues();
    await session.act(() => {
      for (let undo = 0; undo < 60; undo++) session.result.current.undo();
    });
    const undone = [studioValues(), session.result.current.undoIds];
    await session.act(() => {
      for (let redo = 0; redo < 60; redo++) session.result.current.redo();
    });

    expect(undone).toEqual([{ 'studio.width': 320, 'studio.gap': 16, 'studio.tone': 'light' }, null]);
    expect([studioValues(), session.result.current.redoIds]).toEqual([edited, null]);
  }
);

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
