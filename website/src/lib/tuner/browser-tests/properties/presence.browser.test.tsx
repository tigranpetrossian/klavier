import { beforeEach, expect, onTestFinished, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import {
  addRootClass,
  clearPropertyTuning,
  emulateColorScheme,
  renderProperty,
  serveStylesheet,
  settle,
} from '../support/property-harness';
import colors from './presence/colors.css?raw';
import containers from './presence/containers.css?raw';
import elements from './presence/elements.css?raw';
import themeLayer from './served/theme-layer.css?raw';
import { useTunables } from '@/lib/tuner/react';

const DARK_MEDIA = '@media (prefers-color-scheme: dark) :root';

beforeEach(clearPropertyTuning);

test('a declaration that applies to an element is applied, and one that applies nowhere right now is inactive', async () => {
  serveStylesheet(colors);
  await renderSession();

  const base = await renderProperty('--surface');
  const dark = await renderProperty('--surface', '.dark');
  const darkScheme = await renderProperty('--surface', DARK_MEDIA);

  await expect
    .poll(() => [
      base.result.current.entry?.presence,
      dark.result.current.entry?.presence,
      darkScheme.result.current.entry?.presence,
    ])
    .toEqual(['applied', 'inactive', 'inactive']);
});

test('toggling the dark class moves presence to the .dark declaration and back', async () => {
  serveStylesheet(colors);
  await renderSession();
  const base = await renderProperty('--surface');
  const dark = await renderProperty('--surface', '.dark');
  await expect.poll(() => dark.result.current.entry?.presence).toBe('inactive');

  const removeDarkClass = addRootClass('dark');
  await expect
    .poll(() => [base.result.current.entry?.presence, dark.result.current.entry?.presence])
    .toEqual(['inactive', 'applied']);
  removeDarkClass();

  await expect
    .poll(() => [base.result.current.entry?.presence, dark.result.current.entry?.presence])
    .toEqual(['applied', 'inactive']);
});

test('under a dark color scheme the media query declaration applies instead', async () => {
  serveStylesheet(colors);
  await renderSession();
  const base = await renderProperty('--surface');
  const darkScheme = await renderProperty('--surface', DARK_MEDIA);
  await expect.poll(() => darkScheme.result.current.entry?.presence).toBe('inactive');
  await settle();

  await emulateColorScheme('dark');

  await expect
    .poll(() => [base.result.current.entry?.presence, darkScheme.result.current.entry?.presence])
    .toEqual(['inactive', 'applied']);
});

test('a @theme variable Tailwind serves is applied, an unused one is absent, and @theme inline is always absent', async () => {
  serveStylesheet(themeLayer);
  await renderSession();

  const tunables = await renderHook(() => useTunables());

  await expect
    .poll(() =>
      tunables.result.current.flatMap((entry) => (entry.kind === 'property' ? [[entry.id, entry.presence]] : []))
    )
    .toEqual([
      ['--surface|:root', 'absent'],
      ['--brand|:root', 'absent'],
      ['--link|:root', 'absent'],
      ['--surface|.dark', 'absent'],
      ['--brand|.dark', 'absent'],
      ['--surface|@media (prefers-color-scheme: dark) :root', 'absent'],
      ['--inner-gap|@container (min-width: 200px) .inner', 'absent'],
      ['--icon-size|.icon::before', 'absent'],
      ['--chip-pad|.chip', 'absent'],
      ['--color-brand|:root', 'applied'],
      ['--spacing-unused|:root', 'absent'],
      ['--font-sans|:root', 'absent'],
      ['--font-sans|@layer theme :root', 'applied'],
    ]);
});

test('a reference resolves on the element it applies to, through the target declaration in effect there', async () => {
  serveStylesheet(colors);
  await renderSession();
  const link = await renderProperty('--link');
  const darkBrand = await renderProperty('--brand', '.dark');
  await expect
    .poll(() => link.result.current.entry)
    .toMatchObject({ resolved: 'rgb(13, 153, 255)', targetInEffect: '--brand|:root' });
  const lightDarkBrand = darkBrand.result.current.entry?.resolved;

  addRootClass('dark');

  await expect
    .poll(() => link.result.current.entry)
    .toMatchObject({ resolved: 'rgb(255, 153, 0)', targetInEffect: '--brand|.dark' });
  expect([lightDarkBrand, darkBrand.result.current.entry?.resolved]).toEqual([null, 'rgb(255, 153, 0)']);
});

test('a declaration in a container query applies while its container is wide enough', async () => {
  serveStylesheet(containers);
  const box = appendBox();
  await renderSession();
  const innerGap = await renderProperty('--inner-gap', '@container (min-width: 200px) .inner');
  await expect.poll(() => innerGap.result.current.entry?.presence).toBe('applied');

  box.style.width = '100px';

  await expect.poll(() => innerGap.result.current.entry?.presence).toBe('inactive');
});

test('a declaration on a pseudo-element applies through its element', async () => {
  serveStylesheet(elements);
  appendElement('icon');
  await renderSession();

  const iconSize = await renderProperty('--icon-size', '.icon::before');

  await expect.poll(() => iconSize.result.current.entry).toMatchObject({ presence: 'applied', resolved: '4px' });
});

test('a declaration overridden by an inline style on every element it matches is inactive', async () => {
  serveStylesheet(elements);
  appendElement('chip').style.setProperty('--chip-pad', '9px');
  await renderSession();

  const chipPad = await renderProperty('--chip-pad', '.chip');

  await expect.poll(() => chipPad.result.current.entry?.presence).toBe('inactive');
});

function appendElement(className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

function appendBox(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'box';
  box.style.width = '400px';
  box.append(Object.assign(document.createElement('div'), { className: 'inner' }));
  document.body.append(box);
  onTestFinished(() => box.remove());
  return box;
}
