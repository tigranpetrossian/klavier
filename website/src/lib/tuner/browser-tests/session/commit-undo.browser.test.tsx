import { useRef } from 'react';
import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clearTuning, isNumber, renderNumber, renderSession } from '../support/harness';
import { createMemoryStorage, useTunable } from '@/lib/tuner/react';
import { NumberField } from '@/lib/tuner/ui';
import './studio/studio-config';

type Screen = Awaited<ReturnType<typeof render>>;

const PAUSE_MS = 20;

beforeEach(clearTuning);

test('repeated edits of one value stay one step until commitUndo, and the next edit starts a new step', async () => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await width.act(() => width.result.current.onValueChange(410));
  await session.act(() => session.result.current.commitUndo());
  await width.act(() => width.result.current.onValueChange(420));
  const values: number[] = [];

  for (let undo = 0; undo < 2; undo++) {
    await session.act(() => session.result.current.undo());
    values.push(width.result.current.value);
  }

  expect([values, session.result.current.undoIds]).toEqual([[410, 320], null]);
});

test('commitUndo with no open step changes nothing and adds no empty step', async () => {
  const storage = createMemoryStorage();
  const session = await renderSession(storage);
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await session.act(() => session.result.current.commitUndo());

  await session.act(() => {
    session.result.current.commitUndo();
    session.result.current.commitUndo();
  });
  const afterExtraCloses = [session.result.current.undoIds, storage.readHistory()];
  await session.act(() => session.result.current.undo());

  expect(afterExtraCloses).toEqual([
    ['studio.width'],
    { undo: [{ changes: [{ id: 'studio.width', before: 320, after: 400 }] }], redo: [] },
  ]);
  expect([width.result.current.value, session.result.current.undoIds]).toEqual([320, null]);
});

test('commitUndo stores the step it closes', async () => {
  const storage = createMemoryStorage();
  const session = await renderSession(storage);
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  const storedWhileOpen = storage.readHistory();

  await session.act(() => session.result.current.commitUndo());

  expect([storedWhileOpen, storage.readHistory()]).toEqual([
    { undo: [], redo: [] },
    { undo: [{ changes: [{ id: 'studio.width', before: 320, after: 400 }] }], redo: [] },
  ]);
});

test('commitUndo drops a step whose value ended where it started', async () => {
  const storage = createMemoryStorage();
  const session = await renderSession(storage);
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));
  await width.act(() => width.result.current.onValueChange(320));

  await session.act(() => session.result.current.commitUndo());

  expect([session.result.current.undoIds, storage.readHistory()]).toEqual([null, { undo: [], redo: [] }]);
});

test.each([
  ['pointerdown', () => new PointerEvent('pointerdown')],
  ['keydown', () => new KeyboardEvent('keydown', { key: 'Escape' })],
  ['pagehide', () => new PageTransitionEvent('pagehide')],
])('with a session mounted, a window %s closes the open step', async (_, createEvent) => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));

  await width.act(() => window.dispatchEvent(createEvent()));
  await width.act(() => width.result.current.onValueChange(410));
  await session.act(() => session.result.current.undo());

  expect([width.result.current.value, session.result.current.undoIds]).toEqual([400, ['studio.width']]);
});

test('after the session unmounts, a window pointerdown no longer closes the open step', async () => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await session.unmount();
  await width.act(() => width.result.current.onValueChange(400));

  await width.act(() => window.dispatchEvent(new PointerEvent('pointerdown')));
  await width.act(() => width.result.current.onValueChange(410));
  await width.act(() => session.result.current.undo());

  expect(width.result.current.value).toBe(320);
});

test.each([
  ['pointerup', () => new PointerEvent('pointerup')],
  ['pointercancel', () => new PointerEvent('pointercancel')],
  ['pointermove', () => new PointerEvent('pointermove')],
  ['keyup', () => new KeyboardEvent('keyup', { key: 'Escape' })],
  ['Shift keydown', () => new KeyboardEvent('keydown', { key: 'Shift' })],
  ['focus', () => new FocusEvent('focus')],
  ['blur', () => new FocusEvent('blur')],
])('a window %s does not close the open step', async (_, createEvent) => {
  const session = await renderSession();
  const width = await renderNumber('studio.width');
  await width.act(() => width.result.current.onValueChange(400));

  await width.act(async () => {
    window.dispatchEvent(createEvent());
    await pause();
  });
  await width.act(() => width.result.current.onValueChange(410));
  await session.act(() => session.result.current.undo());

  expect([width.result.current.value, session.result.current.undoIds]).toEqual([320, null]);
});

test('separate arrow presses on one slider are one step', async () => {
  const session = await renderSession();
  const screen = await render(<WidthSlider />);
  await focus(screen.getByRole('slider'));

  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByRole('slider')).toHaveValue('320');
});

test('holding an arrow key on a slider is one step', async () => {
  const session = await renderSession();
  const screen = await render(<WidthSlider />);
  await focus(screen.getByRole('slider'));

  await userEvent.keyboard('{ArrowRight>3}{/ArrowRight}');
  await expect.element(screen.getByRole('slider')).toHaveValue('350');
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByRole('slider')).toHaveValue('320');
});

test('arrow presses stay one step when a second session mounts between them', async () => {
  const session = await renderSession();
  const screen = await render(<WidthSlider />);
  await focus(screen.getByRole('slider'));

  await userEvent.keyboard('{ArrowRight}');
  await renderSession();
  await userEvent.keyboard('{ArrowRight}');
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByRole('slider')).toHaveValue('320');
});

test('a modifier key between arrow presses keeps them one step', async () => {
  const session = await renderSession();
  const screen = await render(<WidthSlider />);
  await focus(screen.getByRole('slider'));

  await userEvent.keyboard('{ArrowRight}{Shift}{ArrowRight}');
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByRole('slider')).toHaveValue('320');
});

test.each([
  ['a click', (screen: Screen) => screen.getByRole('button', { name: 'Elsewhere' }).click()],
  ['another key', () => userEvent.keyboard('a')],
])('arrow presses after %s start a new step', async (_, interrupt) => {
  const session = await renderSession();
  const screen = await render(<WidthSlider />);
  await focus(screen.getByRole('slider'));
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');

  await interrupt(screen);
  await focus(screen.getByRole('slider'));
  await userEvent.keyboard('{ArrowRight}');
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByRole('slider')).toHaveValue('340');
});

test('each click of a button is its own step', async () => {
  const session = await renderSession();
  const screen = await render(<WidthStepper />);
  const widen = screen.getByRole('button', { name: 'Widen' });

  await widen.click();
  await widen.click();
  await widen.click();
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByTestId('stepper-width')).toHaveTextContent('340');
});

test('a value typed and committed by a click that edits the same value is a step of its own', async () => {
  const session = await renderSession();
  const screen = await render(<TypedWidth />);

  await userEvent.fill(screen.getByRole('textbox', { name: 'Width' }), '400');
  await screen.getByRole('button', { name: 'Widen' }).click();
  await expect.element(screen.getByTestId('typed-width')).toHaveTextContent('410');
  await session.act(() => session.result.current.undo());

  await expect.element(screen.getByTestId('typed-width')).toHaveTextContent('400');
});

test('a drag is one step, even with a pause in the middle', async () => {
  const session = await renderSession();
  const screen = await render(<WidthScrubber />);
  const scrubber = screen.getByTestId('scrubber').element();

  await session.act(async () => {
    dispatch(scrubber, ['pointerdown', 'pointermove']);
    await pause();
    dispatch(scrubber, ['pointermove', 'pointerup']);
  });
  await expect.element(screen.getByTestId('scrubber')).toHaveTextContent('345');
  await session.act(() => session.result.current.undo());

  expect([scrubber.textContent, session.result.current.undoIds]).toEqual(['320', null]);
});

test('each drag is one step, including the edit made on release', async () => {
  const session = await renderSession();
  const screen = await render(<WidthScrubber />);
  const scrubber = screen.getByTestId('scrubber').element();
  const values: (string | null)[] = [];

  await session.act(() => drag(scrubber));
  await session.act(() => drag(scrubber));
  await expect.element(screen.getByTestId('scrubber')).toHaveTextContent('370');
  for (let undo = 0; undo < 2; undo++) {
    await session.act(() => session.result.current.undo());
    values.push(scrubber.textContent);
  }

  expect(values).toEqual(['345', '320']);
});

function WidthSlider() {
  const width = useTunable('studio.width', isNumber, Number.NaN);
  return (
    <p>
      <input
        type="range"
        aria-label="Width"
        min={0}
        max={1000}
        step={10}
        value={width.value}
        onChange={(event) => width.onValueChange(Number(event.target.value))}
      />
      <button type="button">Elsewhere</button>
    </p>
  );
}

function WidthStepper() {
  const width = useTunable('studio.width', isNumber, Number.NaN);
  return (
    <p>
      <span data-testid="stepper-width">{width.value}</span>
      <button type="button" onClick={() => width.onValueChange(width.value + 10)}>
        Widen
      </button>
    </p>
  );
}

function TypedWidth() {
  const width = useTunable('studio.width', isNumber, Number.NaN);
  return (
    <p>
      <NumberField aria-label="Width" {...width} />
      <span data-testid="typed-width">{width.value}</span>
      <button type="button" onClick={() => width.onValueChange(width.value + 10)}>
        Widen
      </button>
    </p>
  );
}

function WidthScrubber() {
  const width = useTunable('studio.width', isNumber, Number.NaN);
  const drag = useRef({ start: 0, moves: 0 });
  const dragged = () => drag.current.start + 10 * drag.current.moves;
  return (
    <p
      data-testid="scrubber"
      onPointerDown={() => {
        drag.current = { start: width.value, moves: 0 };
      }}
      onPointerMove={() => {
        drag.current.moves++;
        width.onValueChange(dragged());
      }}
      onPointerUp={() => {
        width.onValueChange(dragged() + 5);
      }}
    >
      {width.value}
    </p>
  );
}

function drag(element: Element): void {
  dispatch(element, ['pointerdown', 'pointermove', 'pointermove', 'pointerup']);
}

function dispatch(element: Element, types: readonly string[]): void {
  for (const type of types) element.dispatchEvent(new PointerEvent(type, { bubbles: true }));
}

async function pause(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

async function focus(locator: { element(): Element }): Promise<void> {
  const element = locator.element();
  if (element instanceof HTMLElement) element.focus();
}
