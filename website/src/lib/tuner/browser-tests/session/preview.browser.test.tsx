import { beforeEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { clearTuning, renderNumber, renderSession } from '../support/harness';
import { clearPropertyTuning, renderProperty, serveStylesheet } from '../support/property-harness';
import tokens from './preview/tokens.css?raw';
import { Studio } from './studio/studio';
import { createMemoryStorage } from '@/lib/tuner/react';

beforeEach(clearTuning);

test('a preview shows on the page without changing the value, history or storage, and ending it shows the value again', async () => {
  const storage = createMemoryStorage();
  const screen = await render(<Studio />);
  const session = await renderSession(storage);
  const width = await renderNumber('studio.width');
  let accepted: boolean | undefined;

  await width.act(() => {
    accepted = width.result.current.onPreviewChange(500);
  });
  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 500 16');
  const whilePreviewing = [width.result.current.value, width.result.current.changed, session.result.current.undoIds];
  await width.act(() => width.result.current.onPreviewChange(null));

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 320 16');
  expect([accepted, ...whilePreviewing]).toEqual([true, 320, false, null]);
  expect([storage.readOverrides(), session.result.current.changedCount]).toEqual([{}, 0]);
});

test('setting a value during its preview ends the preview', async () => {
  const screen = await render(<Studio />);
  await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onPreviewChange(500));

  await width.act(() => width.result.current.onValueChange(400));
  await width.act(() => width.result.current.onPreviewChange(null));

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 400 16');
  expect(width.result.current.value).toBe(400);
});

test('setting the current value during a preview ends the preview without an edit', async () => {
  const screen = await render(<Studio />);
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onPreviewChange(500));

  await width.act(() => width.result.current.onValueChange(320));

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 320 16');
  expect(session.result.current.undoIds).toBeNull();
});

test('resetting a value during its preview ends the preview', async () => {
  const screen = await render(<Studio />);
  await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await width.act(() => width.result.current.onPreviewChange(500));

  await width.act(() => width.result.current.onReset());

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 320 16');
});

test('a preview that does not fit the type is rejected and changes nothing', async () => {
  const screen = await render(<Studio />);
  await renderSession();
  const width = await renderNumber('studio.width');
  let accepted: boolean | undefined;

  await width.act(() => {
    accepted = width.result.current.onPreviewChange(Number.NaN);
  });

  await expect.element(screen.getByTestId('studio')).toHaveTextContent('light 320 16');
  expect(accepted).toBe(false);
});

test('a property preview shows on the page and ending it restores the stylesheet value', async () => {
  serveStylesheet(tokens);
  await clearPropertyTuning();
  await renderSession();
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');

  await accent.act(() => accent.result.current.onPreviewChange('#ff0000'));
  const whilePreviewing = [rootValue('--accent'), accent.result.current.value, accent.result.current.changed];
  await accent.act(() => accent.result.current.onPreviewChange(null));

  expect([...whilePreviewing, rootValue('--accent')]).toEqual(['#ff0000', '#0d99ff', false, '#0d99ff']);
});

function rootValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
