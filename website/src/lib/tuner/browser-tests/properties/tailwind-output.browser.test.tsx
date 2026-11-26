import { beforeEach, expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { renderHook } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { clearPropertyTuning, emulateColorScheme, renderProperty, serveStylesheet } from '../support/property-harness';
import tailwindOutput from './served/tailwind-output.css?raw';
import globals from './tailwind-output/globals.css?raw';
import { useTunables } from '@/lib/tuner/react';

beforeEach(clearPropertyTuning);

test('a color with a Lightning CSS fallback is one declaration, and an edit applies over the fallback too', async () => {
  serveStylesheet(tailwindOutput);
  await renderSession();
  const tint = await renderProperty('--tint');
  const tunables = await renderHook(() => useTunables());
  await expect.poll(() => tint.result.current.entry?.presence).toBe('applied');

  await tint.act(() => tint.result.current.onValueChange('oklch(50% 0.2 30)'));

  expect(getComputedStyle(document.documentElement).getPropertyValue('--tint')).toBe('oklch(50% 0.2 30)');
  expect(
    tunables.result.current
      .filter((entry) => entry.kind === 'property' && entry.name === '--tint')
      .map((entry) => entry.id)
  ).toEqual(['--tint|:root']);
});

test('a declaration whose context the build rewrites is found by its name and selector when that pairing is unique', async () => {
  serveStylesheet(tailwindOutput);
  appendElement('tv');
  await page.viewport(800, 600);
  await emulateColorScheme('dark');
  await renderSession();

  const widePad = await renderProperty('--pad', '@media (min-width: 40rem) :root');
  const darkVariant = await renderProperty('--tv', '@variant dark .tv');
  const nestedTitle = await renderProperty('--title-size', '.card .title');

  await expect
    .poll(() => [
      widePad.result.current.entry?.presence,
      darkVariant.result.current.entry?.presence,
      nestedTitle.result.current.entry?.presence,
    ])
    .toEqual(['applied', 'applied', 'inactive']);
});

test('a stylesheet served with native nesting is matched the way the build would flatten it', async () => {
  serveStylesheet(globals);
  appendElement('card');
  appendElement('panel');
  await page.viewport(800, 600);
  await renderSession();

  const cardTitle = await renderProperty('--title-size', '.card .title');
  const panelPad = await renderProperty('--panel-pad', '@media (width >= 40rem) .panel');

  await expect
    .poll(() => [cardTitle.result.current.entry?.presence, panelPad.result.current.entry?.presence])
    .toEqual(['inactive', 'applied']);
});

function appendElement(className: string): void {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);
  onTestFinished(() => element.remove());
}
