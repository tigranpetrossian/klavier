import { afterEach, expect, test } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { clearTuning, isNumber, isString } from '../support/harness';
import { countOf, resetCounts } from '../support/untransformed';
import { Panel } from './studio/panel';
import { useTunable, useTunables, useTuningSession } from '@/lib/tuner/react';

const PANEL_FILE = 'src/lib/tuner/browser-tests/session/studio/panel-config.ts';

afterEach(clearTuning);

test('useTunables lists every registered constant with its value, default, location, options and color model', async () => {
  const width = await renderHook(() => useTunable('panel.width', isNumber, Number.NaN));
  await width.act(() => width.result.current.onValueChange(400));

  const tunables = await renderHook(() => useTunables());

  expect(tunables.result.current).toEqual([
    constantEntry('panel.width', 400, 320, 4, null),
    constantEntry('panel.gutter', 16, 16, 5, null),
    constantEntry('panel.tone', 'light', 'light', 6, ['light', 'dark']),
  ]);
});

test('reset restores a constant to its default', async () => {
  const screen = await render(<Panel />);
  const tone = await renderHook(() => useTunable('panel.tone', isString, ''));
  await tone.act(() => tone.result.current.onValueChange('dark'));

  await tone.act(() => tone.result.current.onReset());

  await expect.element(screen.getByTestId('panel')).toHaveTextContent('light 288');
  expect(tone.result.current.changed).toBe(false);
});

test('the tuning session counts changed values and resets all of them in one update', async () => {
  const screen = await render(<Panel />);
  const session = await renderHook(() => useTuningSession());
  const width = await renderHook(() => useTunable('panel.width', isNumber, Number.NaN));
  const gutter = await renderHook(() => useTunable('panel.gutter', isNumber, Number.NaN));
  await width.act(() => width.result.current.onValueChange(400));
  await gutter.act(() => gutter.result.current.onValueChange(20));
  const changedBeforeReset = session.result.current.changedCount;
  resetCounts();

  await session.act(() => session.result.current.resetAll());

  await expect.element(screen.getByTestId('panel')).toHaveTextContent('light 288');
  expect([changedBeforeReset, session.result.current.changedCount, countOf('CONTENT_WIDTH')]).toEqual([2, 0, 1]);
});

test('an id that is not registered gets a disabled control that shows the fallback and refuses edits', async () => {
  const missing = await renderHook(() => useTunable('panel.missing', isNumber, 12));
  const { entry, value, defaultValue, changed, disabled, onValueChange, onPreviewChange } = missing.result.current;

  expect([entry, value, defaultValue, changed, disabled, onValueChange(14), onPreviewChange(14)]).toEqual([
    null,
    12,
    12,
    false,
    true,
    false,
    false,
  ]);
});

function constantEntry(
  id: string,
  value: unknown,
  defaultValue: unknown,
  line: number,
  options: readonly (string | number)[] | null
) {
  return {
    kind: 'constant',
    id,
    value,
    defaultValue,
    changed: value !== defaultValue,
    location: { file: PANEL_FILE, line },
    options,
    colorModel: null,
  };
}
