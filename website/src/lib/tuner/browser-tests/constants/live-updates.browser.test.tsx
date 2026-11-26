import type { ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { clearTuning, isNumber, isString, ROOTS } from '../support/harness';
import { countOf, resetCounts } from '../support/untransformed';
import { LimitWriter } from './toasts/limit-writer';
import { LazySeeded, SeededCounter, SiblingCounter } from './toasts/toast-counters';
import { ToastEffects } from './toasts/toast-effects';
import { GapList, HookGapList, HookUser } from './toasts/toast-hooks';
import { Bystander, GapReader, GapWhenShown, LimitReader } from './toasts/toast-readers';
import { ToastStack, ToastSummary } from './toasts/toast-stack';
import { useTunable } from '@/lib/tuner/react';

afterEach(async () => {
  await clearTuning();
  resetCounts();
});

describe.each(ROOTS)('in %s', (_, wrapper) => {
  const mount = (ui: ReactNode) => render(ui, { wrapper });

  test('a component renders the default of a tunable constant', async () => {
    const screen = await mount(<ToastStack />);

    await expect.element(screen.getByTestId('toast-limit')).toHaveTextContent('3');
  });

  test('setting a constant through useTunable updates a component that reads it, without a reload', async () => {
    const screen = await mount(<ToastStack />);
    const limit = await tunableNumber('toasts.limit');

    await limit.act(() => limit.result.current.onValueChange(5));

    await expect.element(screen.getByTestId('toast-limit')).toHaveTextContent('5');
  });

  test('a derived constant recomputes once, after everything it reads, across files and a barrel', async () => {
    const screen = await mount(<ToastSummary />);
    const limit = await tunableNumber('toasts.limit');
    resetCounts();

    await limit.act(() => limit.result.current.onValueChange(4));

    await expect.element(screen.getByTestId('toast-summary')).toHaveTextContent('168px for 4');
    expect(countOf('STACK_SUMMARY')).toBe(1);
  });

  test('only components that read the changed constant re-render', async () => {
    await mount(
      <>
        <LimitReader />
        <GapReader />
        <Bystander />
      </>
    );
    const gap = await tunableNumber('toasts.gap');
    resetCounts();

    await gap.act(() => gap.result.current.onValueChange(12));

    expect(ran('render:LimitReader', 'render:GapReader', 'render:Bystander')).toEqual([false, true, false]);
  });

  test('a constant used as initial state remounts its component and children, while siblings keep their state', async () => {
    const screen = await mount(
      <>
        <SeededCounter />
        <SiblingCounter />
      </>
    );
    await screen.getByTestId('seeded-count').click();
    await screen.getByTestId('child-count').click();
    await screen.getByTestId('sibling-count').click();
    const limit = await tunableNumber('toasts.limit');

    await limit.act(() => limit.result.current.onValueChange(7));

    await expect.element(screen.getByTestId('seeded-count')).toHaveTextContent('7');
    await expect.element(screen.getByTestId('child-count')).toHaveTextContent('0');
    await expect.element(screen.getByTestId('sibling-count')).toHaveTextContent('7:1');
  });

  test('a constant read only while rendering updates the component and keeps its state', async () => {
    const screen = await mount(<SeededCounter />);
    await screen.getByTestId('seeded-count').click();
    await screen.getByTestId('child-count').click();
    const gap = await tunableNumber('toasts.gap');

    await gap.act(() => gap.result.current.onValueChange(10));

    await expect.element(screen.getByTestId('seeded-gap')).toHaveTextContent('10');
    await expect.element(screen.getByTestId('seeded-count')).toHaveTextContent('4');
    await expect.element(screen.getByTestId('child-count')).toHaveTextContent('1');
  });

  test('constants read by a lazy initializer or a reducer initializer remount the component, others do not', async () => {
    const screen = await mount(<LazySeeded />);
    const seeded = screen.getByTestId('lazy-seeded');
    const accent = await tunableString('toasts.accent');
    const gap = await tunableNumber('toasts.gap');
    const limit = await tunableNumber('toasts.limit');
    const texts: (string | null)[] = [];

    await seeded.click();
    await accent.act(() => accent.result.current.onValueChange('#222222'));
    texts.push(seeded.element().textContent);
    await gap.act(() => gap.result.current.onValueChange(2));
    texts.push(seeded.element().textContent);
    await seeded.click();
    await limit.act(() => limit.result.current.onValueChange(6));
    texts.push(seeded.element().textContent);

    expect(texts).toEqual(['80/9', '20/8', '20/11']);
  });

  test('effects and memos that read a changed constant run again, and the component keeps its state', async () => {
    const screen = await mount(<ToastEffects />);
    await screen.getByTestId('toast-effects').click();
    const gap = await tunableNumber('toasts.gap');
    resetCounts();

    await gap.act(() => gap.result.current.onValueChange(9));

    await expect.element(screen.getByTestId('toast-effects')).toHaveTextContent('doubled=246 clicks=1');
    expect(ran('effect:gap=9', 'memo:stack')).toEqual([true, true]);
  });

  test('effects and memos do not run again for constants they did not read', async () => {
    await mount(<ToastEffects />);
    const accent = await tunableString('toasts.accent');
    const limit = await tunableNumber('toasts.limit');
    resetCounts();

    await accent.act(() => accent.result.current.onValueChange('#ff0000'));
    const afterAccent = ran('effect:gap', 'memo:stack');
    await limit.act(() => limit.result.current.onValueChange(4));

    expect([afterAccent, ran('effect:gap', 'memo:stack')]).toEqual([
      [false, false],
      [false, true],
    ]);
  });

  test('a component depends on what its last committed render read, following branches', async () => {
    const screen = await mount(<GapWhenShown shown={false} />);
    const gap = await tunableNumber('toasts.gap');
    resetCounts();
    await gap.act(() => gap.result.current.onValueChange(10));
    const renderedWhileHidden = ran('render:GapWhenShown');

    await screen.rerender(<GapWhenShown shown />);
    await gap.act(() => gap.result.current.onValueChange(11));

    await expect.element(screen.getByTestId('gap-when-shown')).toHaveTextContent('11');
    expect(renderedWhileHidden).toEqual([false]);
  });

  test('a component whose constant changes between its render and its commit updates right away', async () => {
    const screen = await mount(<LimitWriter value={null} />);

    await screen.rerender(
      <>
        <LimitWriter value={9} />
        <SiblingCounter />
      </>
    );

    await expect.element(screen.getByTestId('sibling-count')).toHaveTextContent('9:0');
  });

  test('a render prop that reads a constant updates through a memoized child that is not instrumented', async () => {
    const screen = await mount(<GapList />);
    const gap = await tunableNumber('toasts.gap');

    await gap.act(() => gap.result.current.onValueChange(30));

    await expect.element(screen.getByTestId('plain-list')).toHaveTextContent('30,31,');
  });

  test('a custom hook that uses a constant as initial state remounts the component that calls it', async () => {
    const screen = await mount(<HookUser />);
    await screen.getByTestId('hook-user').click();
    const limit = await tunableNumber('toasts.limit');

    await limit.act(() => limit.result.current.onValueChange(6));

    await expect.element(screen.getByTestId('hook-user')).toHaveTextContent('count=6 stack=256');
  });

  test('a closure returned by a custom hook updates through a memoized child that is not instrumented', async () => {
    const screen = await mount(<HookGapList />);
    const gap = await tunableNumber('toasts.gap');

    await gap.act(() => gap.result.current.onValueChange(20));

    await expect.element(screen.getByTestId('plain-list')).toHaveTextContent('20,21,');
  });
});

function tunableNumber(id: string) {
  return renderHook(() => useTunable(id, isNumber, Number.NaN));
}

function tunableString(id: string) {
  return renderHook(() => useTunable(id, isString, ''));
}

function ran(...names: readonly string[]): boolean[] {
  return names.map((name) => countOf(name) > 0);
}
