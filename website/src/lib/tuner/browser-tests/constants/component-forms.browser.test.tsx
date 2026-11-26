import { createRef, type ComponentType } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { clearTuning, isAnything, isNumber, ROOTS } from '../support/harness';
import { countOf, resetCounts } from '../support/untransformed';
import { AliasReader } from './toasts/alias-reader';
import { ArrowForm, MemoArrowForm, MemoForm, RefSeeded, RefTarget } from './toasts/component-forms';
import DefaultArrowForm from './toasts/default-arrow-form';
import DefaultFunctionForm from './toasts/default-function-form';
import { RetryNote } from './toasts/retry-note';
import { ToastBox } from './toasts/toast-box';
import { useTunable } from '@/lib/tuner/react';

const SEEDED_FORMS: readonly (readonly [string, ComponentType<{ label: string }>])[] = [
  ['arrow-form', ArrowForm],
  ['memo-form', MemoForm],
  ['default-function-form', DefaultFunctionForm],
  ['default-arrow-form', DefaultArrowForm],
];

afterEach(async () => {
  await clearTuning();
  resetCounts();
});

describe.each(ROOTS)('in %s', (_, wrapper) => {
  test.each(SEEDED_FORMS)('%s keeps its props and follows initial and render reads', async (testId, Form) => {
    const screen = await render(<Form label="toasts" />, { wrapper });
    const limit = await tunableNumber('toasts.limit');
    const gap = await tunableNumber('toasts.gap');

    await gap.act(() => gap.result.current.onValueChange(9));
    await limit.act(() => limit.result.current.onValueChange(6));

    await expect.element(screen.getByTestId(testId)).toHaveTextContent('toasts:6:9');
  });

  test('a memoized arrow component follows its render reads', async () => {
    const screen = await render(<MemoArrowForm label="toasts" />, { wrapper });
    const limit = await tunableNumber('toasts.limit');

    await limit.act(() => limit.result.current.onValueChange(4));

    await expect.element(screen.getByTestId('memo-arrow-form')).toHaveTextContent('toasts:4:8');
  });

  test('a constant passed to useRef is an initial value, so a change remounts the component', async () => {
    const screen = await render(<RefSeeded />, { wrapper });
    await screen.getByTestId('ref-seeded').click();
    const gap = await tunableNumber('toasts.gap');

    await gap.act(() => gap.result.current.onValueChange(3));

    await expect.element(screen.getByTestId('ref-seeded')).toHaveTextContent('0');
    expect(countOf('ref-seeded:3')).toBeGreaterThan(0);
  });

  test('a ref passed to an instrumented component reaches the element it renders', async () => {
    const ref = createRef<HTMLButtonElement>();

    await render(<RefTarget ref={ref} />, { wrapper });

    expect(ref.current?.dataset.testid).toBe('ref-target');
  });

  test('reads through a namespace import and renamed re-exports update', async () => {
    const screen = await render(<AliasReader />, { wrapper });
    const limit = await tunableNumber('toasts.limit');
    const gap = await tunableNumber('toasts.gap');

    await gap.act(() => gap.result.current.onValueChange(5));
    await limit.act(() => limit.result.current.onValueChange(6));

    await expect.element(screen.getByTestId('alias-reader')).toHaveTextContent('5/6');
  });

  test('names destructured from a constant at the top level update', async () => {
    const screen = await render(<ToastBox />, { wrapper });
    const size = await renderHook(() => useTunable('toasts.size', isAnything, undefined));
    const steps = await renderHook(() => useTunable('toasts.steps', isAnything, undefined));

    await size.act(() => size.result.current.onValueChange({ width: 400, height: 80 }));
    await steps.act(() => steps.result.current.onValueChange([1, 2, 3]));

    await expect.element(screen.getByTestId('toast-box')).toHaveTextContent('400x80 1|2+3');
  });

  test('a module with top-level await loads, and its constants stay tunable', async () => {
    const screen = await render(<RetryNote />, { wrapper });
    const delay = await tunableNumber('toasts.retry-delay');

    await delay.act(() => delay.result.current.onValueChange(250));

    await expect.element(screen.getByTestId('retry-note')).toHaveTextContent('retry in 250');
  });
});

function tunableNumber(id: string) {
  return renderHook(() => useTunable(id, isNumber, Number.NaN));
}
