import { beforeEach, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { clearPropertyTuning, renderProperty, serveStylesheet } from '../support/property-harness';
import tokens from './declarations/tokens.css?raw';
import libraryTokens from './served/library-tokens.css?raw';
import { cssNumber } from '@/lib/tuner/ui';
import { useProperty, useTunables } from '@/lib/tuner/react';

const TOKENS_FILE = 'src/lib/tuner/browser-tests/properties/declarations/tokens.css';
const PX = cssNumber('px');

beforeEach(clearPropertyTuning);

test('a custom property declared in a stylesheet is a value with its default and source location', async () => {
  serveStylesheet(tokens);
  await renderSession();

  const accent = await renderProperty('--accent');

  await expect
    .poll(() => accent.result.current.entry)
    .toMatchObject({
      name: '--accent',
      context: ':root',
      value: '#0d99ff',
      defaultValue: '#0d99ff',
      changed: false,
      editable: true,
      location: { file: TOKENS_FILE, line: 2 },
    });
});

test('custom properties on the page that are not in your stylesheets are listed read-only, folding color fallbacks in and leaving out Tailwind internals', async () => {
  serveStylesheet(tokens);
  serveStylesheet(libraryTokens);
  await renderSession();

  const tunables = await renderHook(() => useTunables());

  await expect
    .poll(() =>
      tunables.result.current.flatMap((entry) =>
        entry.kind === 'property' ? [[entry.id, entry.editable, entry.defaultValue, entry.location]] : []
      )
    )
    .toEqual([
      ['--accent|:root', true, '#0d99ff', { file: TOKENS_FILE, line: 2 }],
      ['--link|:root', true, 'var(--accent)', { file: TOKENS_FILE, line: 3 }],
      ['--ring|:root', true, 'color-mix(in oklab, var(--accent) 40%, transparent)', { file: TOKENS_FILE, line: 4 }],
      ['--accent|.dark', true, '#66c2ff', { file: TOKENS_FILE, line: 8 }],
      ['--font-sans|@layer theme :root', false, 'ui-sans-serif, system-ui', null],
      ['--library-gap|:root', false, '4px', null],
      ['--library-tint|:root', false, 'lab(66.1711% -31.3595 -12.905)', null],
    ]);
});

test.each([
  ['--accent', { form: 'raw', target: null, targetDeclarations: [] }],
  ['--link', { form: 'reference', target: '--accent', targetDeclarations: ['--accent|:root', '--accent|.dark'] }],
  ['--ring', { form: 'expression', target: null, targetDeclarations: [] }],
])('%s holds a value of the form it is written in', async (name, form) => {
  serveStylesheet(tokens);
  await renderSession();

  const property = await renderProperty(name);

  await expect.poll(() => property.result.current.entry).toMatchObject(form);
});

test('a property that is not declared gives a disabled control showing the codec empty value, and every edit is refused', async () => {
  serveStylesheet(tokens);
  await renderSession();
  const tunables = await renderHook(() => useTunables());
  await expect.poll(() => tunables.result.current.some((entry) => entry.kind === 'property')).toBe(true);
  const missing = await renderHook(() => useProperty('--missing', { codec: PX }));
  const results: boolean[] = [];

  await missing.act(() => {
    const control = missing.result.current;
    results.push(control.onValueChange(4), control.onPreviewChange(4), control.pointTo('--accent'), control.detach());
  });

  const { entry, value, defaultValue, changed, disabled, targets } = missing.result.current;
  expect([entry, value, defaultValue, changed, disabled, targets, results]).toEqual([
    null,
    0,
    0,
    false,
    true,
    [],
    [false, false, false, false],
  ]);
});

test('a custom property with no source stylesheet gives a disabled control that refuses edits', async () => {
  serveStylesheet(libraryTokens);
  await renderSession();
  const gap = await renderProperty('--library-gap');
  await expect.poll(() => gap.result.current.entry?.editable).toBe(false);
  let accepted = true;

  await gap.act(() => {
    accepted = gap.result.current.onValueChange('8px');
  });

  const { disabled, value, changed } = gap.result.current;
  expect([disabled, accepted, value, changed]).toEqual([true, false, '4px', false]);
});
