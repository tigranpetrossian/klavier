import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { clearTuning, hotReload, isNumber, renderNumber, renderSession, renderString } from '../support/harness';
import { useTunable } from '@/lib/tuner/react';
import './studio/stops-config';
import './studio/studio-config';

const SAVE_URL = '/api/tuner/save';
const STUDIO_FILE = 'src/lib/tuner/browser-tests/session/studio/studio-config.ts';
const STOPS_FILE = 'src/lib/tuner/browser-tests/session/studio/stops-config.ts';
const NO_NUMBERS: number[] = [];

beforeEach(clearTuning);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('save sends every changed value with its id, location, new value and loaded default, then reports what was saved', async () => {
  const requests = stubSaveEndpoint(() => okResponse(['studio.width', 'studio.tone'], []));
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const tone = await renderString('studio.tone');
  await width.act(() => width.result.current.onValueChange(400));
  await tone.act(() => tone.result.current.onValueChange('dark'));

  await session.act(() => session.result.current.save());

  expect(requests).toEqual([
    {
      method: 'POST',
      body: {
        values: [
          {
            kind: 'constant',
            id: 'studio.width',
            location: { file: STUDIO_FILE, line: 3 },
            value: 400,
            loadedDefault: 320,
          },
          {
            kind: 'constant',
            id: 'studio.tone',
            location: { file: STUDIO_FILE, line: 5 },
            value: 'dark',
            loadedDefault: 'light',
          },
        ],
      },
    },
  ]);
  expect(session.result.current.saveState).toEqual({ status: 'saved', savedCount: 2, skipped: [] });
});

test('values the dev server skips are reported with their locations and reasons', async () => {
  stubSaveEndpoint(() =>
    okResponse(['studio.width'], [{ id: 'studio.gap', reason: 'The file changed since the page loaded' }])
  );
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));

  await session.act(() => session.result.current.save());

  expect(session.result.current.saveState).toEqual({
    status: 'saved',
    savedCount: 1,
    skipped: [
      { id: 'studio.gap', location: { file: STUDIO_FILE, line: 4 }, reason: 'The file changed since the page loaded' },
    ],
  });
});

test.each([
  ['a value', 'saved.stops', 3, listWithHole()],
  ['a default', 'saved.slots', 4, [1, 2]],
])('a constant with %s that is not plain data is skipped before sending, with a reason', async (_, id, line, value) => {
  const requests = stubSaveEndpoint(() => okResponse(['studio.width'], []));
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const list = await renderHook(() => useTunable(id, isNumberList, NO_NUMBERS));
  await width.act(() => width.result.current.onValueChange(400));
  await list.act(() => list.result.current.onValueChange(value));

  await session.act(() => session.result.current.save());

  expect(requests.flatMap((request) => sentIds(request.body))).toEqual(['studio.width']);
  expect(session.result.current.saveState).toEqual({
    status: 'saved',
    savedCount: 1,
    skipped: [{ id, location: { file: STOPS_FILE, line }, reason: expect.any(String) }],
  });
});

test.each([
  ['the dev server cannot be reached', () => Promise.reject(new TypeError('Failed to fetch')), expect.any(String)],
  [
    'the dev server refuses the save',
    () => Response.json({ ok: false, reason: 'Cannot read the source directory' }, { status: 500 }),
    'Cannot read the source directory',
  ],
  ['the dev server answers with an error page', () => new Response('Bad gateway', { status: 502 }), expect.any(String)],
  ['the response is malformed', () => Response.json({ ok: true, saved: 'everything' }), expect.any(String)],
])('when %s, the save fails with one reason', async (_, respond, reason) => {
  stubSaveEndpoint(respond);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));

  await session.act(() => session.result.current.save());

  expect(session.result.current.saveState).toEqual({ status: 'failed', reason });
});

test('saving again while a save is in flight does nothing', async () => {
  const response = Promise.withResolvers<Response>();
  const requests = stubSaveEndpoint(() => response.promise);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  let firstSave: Promise<void> = Promise.resolve();

  await session.act(() => {
    firstSave = session.result.current.save();
  });
  const stateInFlight = session.result.current.saveState;
  await session.act(() => session.result.current.save());
  response.resolve(okResponse(['studio.width'], []));
  await session.act(() => firstSave);

  expect([requests.length, stateInFlight, session.result.current.saveState]).toEqual([
    1,
    { status: 'saving' },
    { status: 'saved', savedCount: 1, skipped: [] },
  ]);
});

test('saving closes the open step, so the next edit of the same value is a step of its own', async () => {
  stubSaveEndpoint(() => okResponse(['studio.width'], []));
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));

  await session.act(() => session.result.current.save());
  await width.act(() => width.result.current.onValueChange(410));
  await session.act(() => session.result.current.undo());

  expect(width.result.current.value).toBe(400);
});

test.each([
  ['without skips returns to idle after a short delay', [], { status: 'idle' }],
  [
    'with skips stays until the next save',
    [{ id: 'studio.width', reason: 'The call was not found' }],
    {
      status: 'saved',
      savedCount: 0,
      skipped: [{ id: 'studio.width', location: { file: STUDIO_FILE, line: 3 }, reason: 'The call was not found' }],
    },
  ],
])('a saved state %s', async (_, skipped, settled) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  stubSaveEndpoint(() => okResponse(skipped.length === 0 ? ['studio.width'] : [], skipped));
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await session.act(() => session.result.current.save());
  const statusAfterSave = session.result.current.saveState.status;

  await session.act(() => vi.advanceTimersByTime(60_000));

  expect([statusAfterSave, session.result.current.saveState]).toEqual(['saved', settled]);
});

test('after hot reload brings the saved default, the override clears and history is untouched', async () => {
  stubSaveEndpoint(() => okResponse(['saved.radius'], []));
  await import('./studio/radius-config');
  const session = await renderSession();
  const radius = await renderNumber('saved.radius');
  await radius.act(() => radius.result.current.onValueChange(12));
  await session.act(() => session.result.current.save());

  await radius.act(() => hotReload('session/studio/radius-config.ts', 'saved'));
  const afterReload = [
    radius.result.current.changed,
    session.result.current.changedCount,
    session.result.current.undoIds,
  ];
  await session.act(() => session.result.current.undo());

  expect(afterReload).toEqual([false, 0, ['saved.radius']]);
  expect([radius.result.current.value, radius.result.current.changed]).toEqual([8, true]);
});

test('saving with nothing to send reports nothing saved without contacting the dev server', async () => {
  const requests = stubSaveEndpoint(() => okResponse([], []));
  const session = await renderSession();

  await session.act(() => session.result.current.save());

  expect([requests.length, session.result.current.saveState]).toEqual([
    0,
    { status: 'saved', savedCount: 0, skipped: [] },
  ]);
});

type SentRequest = { method: string | undefined; body: unknown };

function stubSaveEndpoint(respond: (body: unknown) => Response | Promise<Response>): SentRequest[] {
  const requests: SentRequest[] = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) !== SAVE_URL) return realFetch(input, init);
    const body: unknown = JSON.parse(String(init?.body));
    requests.push({ method: init?.method, body });
    return respond(body);
  });
  return requests;
}

function okResponse(saved: readonly string[], skipped: readonly { id: string; reason: string }[]): Response {
  return Response.json({ ok: true, saved, skipped });
}

function sentIds(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('values' in body) || !Array.isArray(body.values)) return [];
  return body.values.flatMap((value: unknown) =>
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' ? [value.id] : []
  );
}

function listWithHole(): number[] {
  const list = new Array<number>(3);
  list[0] = 0;
  list[2] = 100;
  return list;
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNumber);
}
