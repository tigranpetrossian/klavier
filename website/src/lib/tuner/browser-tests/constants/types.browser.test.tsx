import { afterEach, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { clearTuning, isAnything, isNumber } from '../support/harness';
import { useTunable } from '@/lib/tuner/react';
import { tunable } from '@/lib/tuner/tunable';
import './types/imported-types';
import './types/layout-config';
import './types/local-types';

afterEach(clearTuning);

test.each([
  ['layout.position', 'middle'],
  ['layout.accent', 'blue'],
  ['layout.offset', { x: 1 }],
  ['layout.offset', { x: 1, y: 2, z: 3 }],
  ['layout.steps', [1, '2']],
  ['layout.shadow', [2, 'soft', 'extra']],
  ['layout.max-width', 'wide'],
  ['layout.density', 3],
  ['layout.title', 3],
  ['layout.size', { width: '320', height: 64 }],
  ['layout.animated', 'yes'],
  ['layout.max-width', Number.NaN],
  ['layout.max-width', Number.POSITIVE_INFINITY],
  ['layout.badge', { kind: 'dot', max: 9 }],
  ['layout.badge', { kind: 'ring', size: 6 }],
])('setting %s to a value outside its type returns false and changes nothing', async (id, value) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));
  let accepted = true;

  await control.act(() => {
    accepted = control.result.current.onValueChange(value);
  });

  expect([accepted, control.result.current.changed]).toEqual([false, false]);
});

test.each([
  ['layout.position', 'top-left'],
  ['layout.accent', 'oklch(0.7 0.1 200)'],
  ['layout.offset', { x: 1, y: 2 }],
  ['layout.steps', []],
  ['layout.shadow', [0, 'hard']],
  ['layout.max-width', 640],
  ['layout.density', 2],
  ['layout.title', 'Inbox'],
  ['layout.size', { width: 1, height: 2 }],
  ['layout.animated', false],
  ['layout.badge', { kind: 'count', max: 9 }],
])('setting %s to a value of its type changes it', async (id, value) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));
  let accepted = false;

  await control.act(() => {
    accepted = control.result.current.onValueChange(value);
  });

  expect([accepted, control.result.current.value, control.result.current.changed]).toEqual([true, value, true]);
});

test.each([
  ['layout.position', ['top-left', 'top-right', 'bottom-left', 'bottom-right'], null],
  ['layout.density', [1, 2, 'auto'], null],
  ['layout.accent', null, 'hex'],
  ['layout.title', null, null],
  ['layout.max-width', null, null],
])('%s exposes its literal options and the color model of its default', async (id, options, colorModel) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));

  expect([control.result.current.entry?.options, control.result.current.entry?.colorModel]).toEqual([
    options,
    colorModel,
  ]);
});

test('a constant reports where its call site is', async () => {
  const control = await renderHook(() => useTunable('layout.accent', isAnything, undefined));

  expect(control.result.current.entry?.location).toEqual({
    file: 'src/lib/tuner/browser-tests/constants/types/layout-config.ts',
    line: 7,
  });
});

test('a constant is not editable through a check its default fails', async () => {
  const maxWidth = await renderHook(() => useTunable('layout.max-width', isAnything, undefined));
  await maxWidth.act(() => maxWidth.result.current.onValueChange(640));

  const control = await renderHook(() => useTunable('layout.max-width', isNumber, Number.NaN));

  expect([control.result.current.entry, control.result.current.disabled]).toEqual([null, true]);
});

test('without the transform, tunable returns its default', () => {
  expect(tunable('layout.untransformed', { gap: 4 })).toEqual({ gap: 4 });
});

test('a constant is not editable through a check its value fails', async () => {
  const control = await renderHook(() => useTunable('layout.accent', isNumber, Number.NaN));

  expect([control.result.current.entry, control.result.current.disabled]).toEqual([null, true]);
});

test('setting a copy of the current value does nothing, and setting a copy of the default clears the change', async () => {
  const control = await renderHook(() => useTunable('layout.offset', isAnything, undefined));
  const changes: unknown[] = [];

  await control.act(() => control.result.current.onValueChange({ x: 0, y: 8 }));
  changes.push(control.result.current.changed);
  await control.act(() => control.result.current.onValueChange({ x: 5, y: 8 }));
  changes.push(control.result.current.changed);
  await control.act(() => control.result.current.onValueChange({ x: 0, y: 8 }));
  changes.push(control.result.current.changed);

  expect(changes).toEqual([false, true, false]);
});

test.each([
  ['types.interface', { tone: 'warn', count: 2 }, { tone: 'error', count: 2 }],
  ['types.extended-interface', { tone: 'warn', count: 2, label: 'Old' }, { tone: 'error', count: 2, label: 'Old' }],
  ['types.readonly-points', [{ x: 1, y: 2 }], [{ x: 1 }]],
  ['types.corner-array', ['top-right', 'top-left'], ['middle']],
  ['types.level-array', [2, 1], [3]],
  ['types.anchor-tuple', ['top-right', 4], ['middle', 4]],
  [
    'types.nested-object',
    { offset: { x: 1, y: 1 }, blur: { radius: 2, tone: 'hard' } },
    { offset: { x: 1, y: 1 }, blur: { radius: 2, tone: 'blurry' } },
  ],
  ['types.marker', { kind: 'ring', width: 2 }, { kind: 'square', size: 2 }],
  ['types.nullable-point', { x: 1, y: 2 }, { x: 1 }],
  ['imported.badge', { tone: 'warn', count: 3 }, { tone: 'error', count: 3 }],
  ['imported.swatch', { name: 'Ink', color: 'oklch(0.5 0.1 20)' }, { name: 'Ink', color: 'ink' }],
])('%s accepts a value of its declared type and rejects one outside it', async (id, inside, outside) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));
  const accepted: unknown[] = [];

  await control.act(() => {
    accepted.push(control.result.current.onValueChange(inside));
  });
  await control.act(() => {
    accepted.push(control.result.current.onValueChange(outside));
  });

  expect(accepted).toEqual([true, false]);
});

test.each([
  ['imported.corner', ['top-left', 'top-right'], null],
  ['imported.placement', ['top-left', 'top-right'], null],
  ['imported.side', ['top-left', 'top-right'], null],
  ['imported.namespaced-corner', ['top-left', 'top-right'], null],
  ['imported.paint', null, 'rgb'],
  ['imported.shade', null, 'hsl'],
])('%s, a type imported from another file, exposes options %j and color model %j', async (id, options, colorModel) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));

  expect([control.result.current.entry?.options, control.result.current.entry?.colorModel]).toEqual([
    options,
    colorModel,
  ]);
});
