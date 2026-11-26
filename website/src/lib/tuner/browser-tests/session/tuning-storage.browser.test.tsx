import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { clearTuning, renderNumber } from '../support/harness';
import { createBrowserStorage, createMemoryStorage, useTuningSession } from '@/lib/tuner/react';
import './studio/studio-config';

beforeEach(async () => {
  await clearTuning();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('by default the session keeps overrides in local storage and history in session storage', async () => {
  await renderHook(() => useTuningSession());
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  const stored = [createBrowserStorage().readOverrides(), createBrowserStorage().readHistory()];

  sessionStorage.clear();
  const afterSessionCleared = [createBrowserStorage().readOverrides(), createBrowserStorage().readHistory()];
  localStorage.clear();

  expect([...stored, ...afterSessionCleared, createBrowserStorage().readOverrides()]).toEqual([
    { 'studio.width': 400, 'studio.gap': 20 },
    { undo: [{ changes: [{ id: 'studio.width', before: 320, after: 400 }] }], redo: [] },
    { 'studio.width': 400, 'studio.gap': 20 },
    null,
    {},
  ]);
});

test('browser storage failures are ignored, and edits keep working, even with a storage created while rendering', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Storage is disabled', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage is full', 'QuotaExceededError');
  });
  await renderHook(() => useTuningSession({ storage: createBrowserStorage() }));
  const width = await renderNumber('studio.width');

  await width.act(() => width.result.current.onValueChange(400));

  const storage = createBrowserStorage();
  expect([width.result.current.value, storage.readOverrides(), storage.readHistory()]).toEqual([400, {}, null]);
});

test.each([
  ['text that is not JSON', 'not json', null],
  ['a list', '[1, 2]', [1, 2]],
  ['nothing', 'null', null],
])('browser storage holding %s reads as no overrides', (_, text, history) => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(text);
  const storage = createBrowserStorage();

  expect([storage.readOverrides(), storage.readHistory()]).toEqual([{}, history]);
});

test('a new memory storage holds nothing, so nothing survives a reload', () => {
  const storage = createMemoryStorage();

  expect([storage.readOverrides(), storage.readHistory()]).toEqual([{}, null]);
});
