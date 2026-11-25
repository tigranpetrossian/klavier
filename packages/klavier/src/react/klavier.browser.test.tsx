import { Profiler, StrictMode, createRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { CSSProperties, ReactElement } from 'react';
import { layoutKeys } from '../layout-keys';
import { keyboard, mouse, releaseAllInput } from '../testing/real-input';
import type { NoteOffEvent, NoteOnEvent } from '../klavier-types';
import type { KlavierLayout } from '../layout-keys';
import { Klavier } from './klavier';
import type { KlavierHandle } from './klavier';

const BOX: CSSProperties = { position: 'fixed', left: 40, top: 40, width: 720, height: 160 };
const C4 = { x: 40 + 7.5 * 48, y: 40 + 140 };
const D4 = { x: 40 + 8.5 * 48, y: 40 + 140 };

afterEach(async () => {
  await releaseAllInput();
  document.body.replaceChildren();
});

test('playing notes never re-renders the component', async () => {
  const commits: string[] = [];
  const noteOns: number[] = [];
  await render(
    <Profiler id="klavier" onRender={(id, phase) => commits.push(phase)}>
      <Klavier range={[48, 72]} style={BOX} onNoteOn={(event) => noteOns.push(event.note)} />
    </Profiler>
  );

  await mouse.down(C4);
  await mouse.move(D4);
  await mouse.up();

  expect(noteOns).toEqual([60, 62]);
  expect(commits).toEqual(['mount']);
});

test('events go to the handlers of the latest render', async () => {
  const first = vi.fn<(event: NoteOnEvent) => void>();
  const second = vi.fn<(event: NoteOffEvent) => void>();
  const screen = await render(<Klavier range={[48, 72]} style={BOX} onNoteOn={first} />);

  await mouse.down(C4);
  await screen.rerender(<Klavier range={[48, 72]} style={BOX} onNoteOff={second} />);
  await mouse.up();
  await mouse.down(C4);

  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledExactlyOnceWith({ note: 60, cancelled: false });
});

test('onLayout reports the first layout and every later one', async () => {
  const layouts: KlavierLayout[] = [];
  const onLayout = (layout: KlavierLayout): void => {
    layouts.push(layout);
  };
  const screen = await render(<Klavier range={[48, 72]} style={BOX} onLayout={onLayout} />);

  expect(layouts).toEqual([layoutKeys({ range: [48, 72], width: 720, height: 160, pixelRatio: devicePixelRatio })]);

  await screen.rerender(<Klavier range={[60, 71]} style={BOX} onLayout={onLayout} />);

  expect(layouts.at(-1)).toEqual(
    layoutKeys({ range: [60, 71], width: 720, height: 160, pixelRatio: devicePixelRatio })
  );
});

test('the ref gives the layout and moves focus to the keys', async () => {
  const handle = createRef<KlavierHandle>();
  await render(<Klavier range={[60, 71]} style={BOX} ref={handle} />);

  handle.current?.focus();

  expect(handle.current?.layout.keys).toHaveLength(12);
  expect(document.activeElement).toHaveAttribute('aria-label', 'C4');
});

test('redraw through the ref repaints a painter that reads outside state', async () => {
  const handle = createRef<KlavierHandle>();
  const painted: string[] = [];
  let colour = 'red';
  await render(<Klavier style={BOX} ref={handle} painter={() => painted.push(colour)} />);
  await expect.poll(() => painted).toEqual(['red']);

  colour = 'blue';
  handle.current?.redraw();

  await expect.poll(() => painted).toEqual(['red', 'blue']);
});

test('other props land on the root element', async () => {
  const screen = await render(<Klavier className="piano" style={BOX} role="group" aria-label="Piano" />);

  await expect.element(screen.getByRole('group', { name: 'Piano' })).toHaveClass('piano');
});

test('pressed state kept by the app follows the notes', async () => {
  const screen = await render(<AppDrivenKlavier />);

  await mouse.down(C4);

  await expect.element(screen.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await mouse.up();

  await expect
    .element(screen.getByRole('button', { name: 'C4', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
});

test('strict mode leaves one keyboard that plays each note once', async () => {
  const events: string[] = [];
  const screen = await render(
    <StrictMode>
      <Klavier
        range={[48, 72]}
        style={BOX}
        onNoteOn={(event) => events.push(`on ${event.note}`)}
        onNoteOff={(event) => events.push(`off ${event.note}`)}
      />
    </StrictMode>
  );

  await mouse.down(C4);
  await mouse.up();

  expect(screen.container.querySelectorAll('canvas')).toHaveLength(1);
  expect(screen.container.querySelectorAll('button')).toHaveLength(25);
  expect(events).toEqual(['on 60', 'off 60']);
});

test('unmounting removes the listeners it put on the window', async () => {
  const noteOns: number[] = [];
  const screen = await render(
    <Klavier range={[48, 72]} computerKeyboard="global" onNoteOn={(event) => noteOns.push(event.note)} />
  );

  await screen.unmount();
  await keyboard.press('KeyQ');

  expect(noteOns).toEqual([]);
});

test('server markup reserves the height of the keys and hydrates cleanly', async () => {
  const consoleError = vi.spyOn(console, 'error');
  const container = document.createElement('div');
  container.style.width = '470px';
  document.body.append(container);

  container.innerHTML = renderToString(<Klavier range={[60, 71]} />);
  const heightBeforeHydration = container.getBoundingClientRect().height;
  const root = hydrateRoot(container, <Klavier range={[60, 71]} />);

  await expect.poll(() => container.querySelectorAll('button')).toHaveLength(12);
  expect(Math.round(heightBeforeHydration)).toBe(Math.round(470 / ((7 * 23.5) / 150)));
  expect(container.getBoundingClientRect().height).toBe(heightBeforeHydration);
  expect(consoleError).not.toHaveBeenCalled();

  root.unmount();
  consoleError.mockRestore();
});

function AppDrivenKlavier(): ReactElement {
  const [pressed, setPressed] = useState<readonly number[]>([]);

  return (
    <Klavier
      range={[48, 72]}
      style={BOX}
      pressed={pressed}
      onNoteOn={({ note }) => setPressed((notes) => [...notes, note])}
      onNoteOff={({ note }) => setPressed((notes) => notes.filter((held) => held !== note))}
    />
  );
}
