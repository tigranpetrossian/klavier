import { startTransition, Suspense, useState } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { clearTuning, isNumber, ROOTS } from '../support/harness';
import { SlowComponent } from '../support/untransformed';
import { SuspendingReader } from './toasts/suspending-reader';
import { SiblingCounter } from './toasts/toast-counters';
import { useTunable } from '@/lib/tuner/react';

afterEach(clearTuning);

describe.each(ROOTS)('in %s', (_, wrapper) => {
  test('a component that read a constant and then suspended shows the current value when it commits', async () => {
    const text = Promise.withResolvers<string>();
    const screen = await render(
      <Suspense fallback={<span data-testid="fallback">loading</span>}>
        <SuspendingReader text={text.promise} />
      </Suspense>,
      { wrapper }
    );
    const limit = await renderHook(() => useTunable('toasts.limit', isNumber, Number.NaN));

    await limit.act(() => limit.result.current.onValueChange(13));
    text.resolve('ready');
    await expect.element(screen.getByTestId('suspending-reader')).toHaveTextContent('ready:13');
    await limit.act(() => limit.result.current.onValueChange(14));

    await expect.element(screen.getByTestId('suspending-reader')).toHaveTextContent('ready:14');
  });

  test('a write while a time-sliced transition is rendering reaches components it already rendered', async () => {
    let show: (visible: boolean) => void = () => {};
    function TransitionHost() {
      const [visible, setVisible] = useState(false);
      show = setVisible;
      return visible ? (
        <>
          <SiblingCounter />
          {[0, 1, 2, 3, 4].map((index) => (
            <SlowComponent key={index} milliseconds={20} />
          ))}
        </>
      ) : null;
    }
    const screen = await render(<TransitionHost />, { wrapper });
    const limit = await renderHook(() => useTunable('toasts.limit', isNumber, Number.NaN));
    const setLimit = limit.result.current.onValueChange;
    await limit.unmount();

    startTransition(() => show(true));
    setTimeout(() => setLimit(21), 30);

    await expect.element(screen.getByTestId('sibling-count')).toHaveTextContent('21:0');
  });
});
