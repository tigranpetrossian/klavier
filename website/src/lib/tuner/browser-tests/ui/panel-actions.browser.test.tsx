import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { clearTuning, renderNumber } from '../support/harness';
import { openPanel } from '../support/panel-harness';
import { Panel } from '@/lib/tuner/ui';
import '../session/studio/studio-config';

const SAVE_URL = '/api/tuner/save';

beforeEach(clearTuning);

afterEach(() => {
  vi.unstubAllGlobals();
});

test('undo puts back the last change and redo makes it again', async () => {
  const screen = await renderOpenPanel();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));

  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => width.result.current.value).toBe(320);
  await screen.getByRole('button', { name: 'Redo' }).click();

  await expect.poll(() => width.result.current.value).toBe(400);
});

test('undo and redo are disabled while there is nothing to undo or redo', async () => {
  const screen = await renderOpenPanel();
  const width = await renderNumber('studio.width');
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect.element(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

  await width.act(() => width.result.current.onValueChange(400));

  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect.element(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('reset puts every changed value back to its default', async () => {
  const screen = await renderOpenPanel();
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));

  await screen.getByRole('button', { name: 'Reset' }).click();

  await expect.poll(() => [width.result.current.value, gap.result.current.value]).toEqual([320, 16]);
});

test('reset and save are disabled until a value changes', async () => {
  const screen = await renderOpenPanel();
  const width = await renderNumber('studio.width');
  await expect.element(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  await expect.element(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

  await width.act(() => width.result.current.onValueChange(400));

  await expect.element(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  await expect.element(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('save sends the changed values to the dev server', async () => {
  const savedIds = stubSaveEndpoint();
  const screen = await renderOpenPanel();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));

  await screen.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => savedIds).toEqual([['studio.width']]);
});

async function renderOpenPanel() {
  const screen = await render(
    <Panel.Root>
      <Panel.Trigger />
      <Panel.Drawer>
        <Panel.Header>
          <Panel.Title>Tuner</Panel.Title>
          <Panel.Undo />
          <Panel.Redo />
          <Panel.Close />
        </Panel.Header>
        <Panel.Footer>
          <Panel.Reset />
          <Panel.Save />
        </Panel.Footer>
      </Panel.Drawer>
    </Panel.Root>
  );
  await openPanel();
  return screen;
}

function stubSaveEndpoint(): string[][] {
  const savedIds: string[][] = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) !== SAVE_URL) return realFetch(input, init);
    const ids = sentIds(JSON.parse(String(init?.body)));
    savedIds.push(ids);
    return Response.json({ ok: true, saved: ids, skipped: [] });
  });
  return savedIds;
}

function sentIds(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('values' in body) || !Array.isArray(body.values)) return [];
  return body.values.flatMap((value: unknown) =>
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' ? [value.id] : []
  );
}
