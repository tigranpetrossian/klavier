import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { Studio } from '../session/studio/studio';
import { renderNumber, renderSession, silenceConsole, tunerProblem } from '../support/harness';
import {
  clearPropertyTuning,
  hotReloadStylesheet,
  renderProperty,
  serveLinkedStylesheet,
  serveStylesheet,
} from '../support/property-harness';
import tokens from './property-session/tokens.css?raw';
import { createMemoryStorage, type TuningStorage } from '@/lib/tuner/react';

const TOKENS_FILE = 'src/lib/tuner/browser-tests/properties/property-session/tokens.css';
const STUDIO_FILE = 'src/lib/tuner/browser-tests/session/studio/studio-config.ts';
const SAVE_ENDPOINT = '/api/tuner/save';
const SAVED_FILE = 'src/lib/tuner/browser-tests/properties/property-session/saved.css';

beforeEach(clearPropertyTuning);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('one history covers constants and custom properties, undoing and redoing them in order', async () => {
  serveStylesheet(tokens);
  const screen = await render(<Studio />);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');
  await width.act(() => width.result.current.onValueChange(400));
  await accent.act(() => accent.result.current.onValueChange('#ff0000'));
  await width.act(() => width.result.current.onValueChange(410));
  const states: unknown[] = [];
  const record = () => states.push([screen.getByTestId('studio').element().textContent, rootValue('--accent')]);

  for (let undo = 0; undo < 3; undo++) {
    await session.act(() => session.result.current.undo());
    record();
  }
  for (let redo = 0; redo < 3; redo++) {
    await session.act(() => session.result.current.redo());
    record();
  }

  expect(states).toEqual([
    ['light 400 16', '#ff0000'],
    ['light 400 16', '#0d99ff'],
    ['light 320 16', '#0d99ff'],
    ['light 400 16', '#0d99ff'],
    ['light 400 16', '#ff0000'],
    ['light 410 16', '#ff0000'],
  ]);
});

test('a stored property override applies once the declarations load, outside history, and edits are stored by id', async () => {
  serveStylesheet(tokens);
  const storage = createMemoryStorage();
  storage.writeOverrides({ '--accent|:root': '#ff0000', 'elsewhere.size': 3 });
  const session = await renderSession(storage);
  const accent = await renderProperty('--accent');
  const gap = await renderProperty('--gap');
  await expect.poll(() => accent.result.current.changed).toBe(true);
  const restored = [rootValue('--accent'), session.result.current.changedCount, session.result.current.undoIds];

  await gap.act(() => gap.result.current.onValueChange('12px'));

  expect(restored).toEqual(['#ff0000', 1, null]);
  expect(storage.readOverrides()).toEqual({ '--accent|:root': '#ff0000', '--gap|:root': '12px', 'elsewhere.size': 3 });
});

test('a stored property override that no longer fits its declaration is dropped with a warning', async () => {
  const warnings = silenceConsole('warn');
  serveStylesheet(tokens);
  const storage = createMemoryStorage();
  storage.writeOverrides({ '--gap|:root': 'red' });
  await renderSession(storage);
  const gap = await renderProperty('--gap');

  await expect.poll(() => gap.result.current.entry?.presence).toBe('applied');

  expect([gap.result.current.value, gap.result.current.changed, rootValue('--gap')]).toEqual(['8px', false, '8px']);
  expect(warnings).toHaveBeenCalledWith(tunerProblem('--gap|:root', `${TOKENS_FILE}:3`));
});

test('saving sends a changed property with its id, name, context, location, new value and loaded default', async () => {
  const requests = stubSaveEndpoint(() =>
    Response.json({ ok: true, saved: ['--accent|:root', 'studio.width'], skipped: [] })
  );
  serveStylesheet(tokens);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');
  await width.act(() => width.result.current.onValueChange(400));
  await accent.act(() => accent.result.current.onValueChange('#ff0000'));

  await session.act(() => session.result.current.save());

  expect(requests).toEqual([
    {
      values: [
        {
          kind: 'constant',
          id: 'studio.width',
          location: { file: STUDIO_FILE, line: 3 },
          value: 400,
          loadedDefault: 320,
        },
        {
          kind: 'property',
          id: '--accent|:root',
          name: '--accent',
          context: ':root',
          location: { file: TOKENS_FILE, line: 2 },
          value: '#ff0000',
          loadedDefault: '#0d99ff',
        },
      ],
    },
  ]);
  expect(session.result.current.saveState).toEqual({ status: 'saved', savedCount: 2, skipped: [] });
});

test('after a save, a hot reload that brings the saved default back reformatted clears the override and leaves history alone', async () => {
  stubSaveEndpoint(() => Response.json({ ok: true, saved: ['--saved-accent|:root'], skipped: [] }));
  const link = await serveLinkedStylesheet(':root { --saved-accent: #00f; }');
  const session = await renderSession();
  const accent = await renderProperty('--saved-accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');
  await accent.act(() => accent.result.current.onValueChange('#ff0000'));
  await session.act(() => session.result.current.save());

  await rewriteSource(SAVED_FILE, ':root {\n  --saved-accent: #FF0000;\n}\n');
  await hotReloadStylesheet(link, ':root { --saved-accent: red; }');

  await expect.poll(() => accent.result.current.defaultValue).toBe('#FF0000');
  const afterReload = [
    accent.result.current.changed,
    session.result.current.changedCount,
    session.result.current.undoIds,
  ];
  await session.act(() => session.result.current.undo());
  expect(afterReload).toEqual([false, 0, ['--saved-accent|:root']]);
  expect([accent.result.current.value, accent.result.current.changed]).toEqual(['#0000ff', true]);
});

test('a custom storage that throws never breaks the session, and edits and undo keep working', async () => {
  serveStylesheet(tokens);
  const session = await renderSession(throwingStorage());
  const width = await renderNumber('studio.width');
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');

  await accent.act(() => accent.result.current.onValueChange('#ff0000'));
  await width.act(() => width.result.current.onValueChange(400));
  await session.act(() => session.result.current.undo());

  expect([rootValue('--accent'), width.result.current.value, session.result.current.changedCount]).toEqual([
    '#ff0000',
    320,
    1,
  ]);
});

function throwingStorage(): TuningStorage {
  const fail = (): never => {
    throw new Error('The storage is unavailable');
  };
  return { readOverrides: fail, writeOverrides: fail, readHistory: fail, writeHistory: fail };
}

async function rewriteSource(file: string, text: string): Promise<void> {
  const original = await commands.readFile(file);
  onTestFinished(() => commands.writeFile(file, original));
  await commands.writeFile(file, text);
}

function stubSaveEndpoint(respond: () => Response): unknown[] {
  const requests: unknown[] = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) !== SAVE_ENDPOINT) return realFetch(input, init);
    requests.push(JSON.parse(String(init?.body)));
    return respond();
  });
  return requests;
}

function rootValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
