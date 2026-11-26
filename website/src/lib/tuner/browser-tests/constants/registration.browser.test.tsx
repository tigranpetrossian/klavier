import { afterEach, expect, test, vi } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { hotReload, isNumber, isString, silenceConsole, tunerProblem } from '../support/harness';
import { GapPair } from './registration/gap-reader';
import { InlineRadius } from './registration/inline-radius';
import { useTunable } from '@/lib/tuner/react';

afterEach(() => {
  vi.restoreAllMocks();
});

test('a second call site with the same id in one module is reported, and the first call site keeps the id', async () => {
  const errors = silenceConsole('error');
  const radii = await import('./registration/same-module');
  const radius = await renderHook(() => useTunable('duplicate.radius', isNumber, Number.NaN));

  await radius.act(() => radius.result.current.onValueChange(10));

  expect(errors).toHaveBeenCalledWith(
    tunerProblem('duplicate.radius', 'src/lib/tuner/browser-tests/constants/registration/same-module.ts:4')
  );
  expect([radii.FIRST_RADIUS, radii.SECOND_RADIUS, radius.result.current.entry?.location?.line]).toEqual([10, 6, 3]);
});

test('a call site in another module that uses a taken id is reported, and the first module keeps the id', async () => {
  const errors = silenceConsole('error');
  const first = await import('./registration/first-owner');
  const second = await import('./registration/second-owner');
  const delay = await renderHook(() => useTunable('duplicate.delay', isNumber, Number.NaN));

  await delay.act(() => delay.result.current.onValueChange(150));

  expect(errors).toHaveBeenCalledWith(
    tunerProblem('duplicate.delay', 'src/lib/tuner/browser-tests/constants/registration/second-owner.ts:3')
  );
  expect([first.OWNED_DELAY, second.CLAIMED_DELAY]).toEqual([150, 200]);
});

test('an override survives hot reload of its module, and a call that moved keeps its id', async () => {
  const errors = silenceConsole('error');
  await import('./registration/label-config');
  const label = await renderHook(() => useTunable('hot.label', isString, ''));
  await label.act(() => label.result.current.onValueChange('Hi'));

  await label.act(() => hotReload('constants/registration/label-config.ts', 'moved'));

  expect([label.result.current.value, label.result.current.entry?.location?.line]).toEqual(['Hi', 5]);
  expect(errors).not.toHaveBeenCalled();
});

test('hot reload that changes a default to the overridden value clears the override', async () => {
  await import('./registration/limit-config');
  const limit = await renderHook(() => useTunable('hot.limit', isNumber, Number.NaN));
  await limit.act(() => limit.result.current.onValueChange(5));

  await limit.act(() => hotReload('constants/registration/limit-config.ts', 'raised'));

  expect([limit.result.current.value, limit.result.current.changed]).toEqual([5, false]);
});

test('hot reload that changes a type drops an override that no longer fits, with a warning', async () => {
  const warnings = silenceConsole('warn');
  await import('./registration/mode-config');
  const mode = await renderHook(() => useTunable('hot.mode', isString, ''));
  await mode.act(() => mode.result.current.onValueChange('busy'));

  await mode.act(() => hotReload('constants/registration/mode-config.ts', 'retyped'));

  expect(warnings).toHaveBeenCalledWith(
    tunerProblem('hot.mode', 'src/lib/tuner/browser-tests/constants/registration/mode-config.ts:3')
  );
  expect([mode.result.current.value, mode.result.current.changed]).toEqual(['quiet', false]);
});

test('hot reload of a new default updates readers and derived constants in modules that were not reloaded', async () => {
  const screen = await render(<GapPair />);

  await hotReload('constants/registration/gap-config.ts', 'widened');

  await expect.element(screen.getByTestId('gap-pair')).toHaveTextContent('12/24');
});

test('a constant registers the first time its call runs, even inside a component', async () => {
  const before = await renderHook(() => useTunable('inline.radius', isNumber, Number.NaN));
  const registeredBeforeRender = before.result.current.entry !== null;

  const screen = await render(<InlineRadius />);
  const radius = await renderHook(() => useTunable('inline.radius', isNumber, Number.NaN));
  await radius.act(() => radius.result.current.onValueChange(6));

  await expect.element(screen.getByTestId('inline-radius')).toHaveTextContent('6');
  expect(registeredBeforeRender).toBe(false);
});
