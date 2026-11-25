import { afterEach, expect, test } from 'vitest';
import { createKlavier } from './create-klavier';
import { layoutKeys } from './layout-keys';
import { mouse, releaseAllInput } from './testing/real-input';
import type { Frame, KlavierInstance, Painter } from './klavier-types';

const C4 = { x: 40 + 7.5 * 48, y: 40 + 140 };
const D4 = { x: 40 + 8.5 * 48, y: 40 + 140 };

const instances: KlavierInstance[] = [];

afterEach(async () => {
  await releaseAllInput();
  for (const instance of instances.splice(0)) instance.destroy();
  document.body.replaceChildren();
});

test('the layout is known as soon as the keyboard is created', () => {
  const instance = create();

  expect(instance.layout).toEqual(
    layoutKeys({ range: [48, 72], width: 720, height: 160, pixelRatio: devicePixelRatio })
  );
});

test('a keyboard created off the page lays out once its root is attached', async () => {
  const root = document.createElement('div');
  Object.assign(root.style, { width: '300px', height: '80px' });
  const instance = createKlavier(root, { range: [60, 71] });
  instances.push(instance);

  expect(instance.layout.width).toBe(0);

  document.body.append(root);

  await expect.poll(() => [instance.layout.width, instance.layout.height]).toEqual([300, 80]);
});

test('a listener stops hearing events once it is removed', async () => {
  const instance = create();
  const heard: number[] = [];
  const stopListening = instance.on('noteon', (event) => heard.push(event.note));

  await mouse.down(C4);
  await mouse.up();
  stopListening();
  await mouse.down(C4);

  expect(heard).toEqual([60]);
});

test('changing the range from inside a noteon listener keeps every note paired and in order', async () => {
  const instance = create();
  const heard: string[] = [];
  instance.on('noteon', (event) => {
    heard.push(`on ${event.note}`);
    instance.update({ range: [60, 71] });
  });
  instance.on('noteon', (event) => heard.push(`also on ${event.note}`));
  instance.on('noteoff', (event) => heard.push(`off ${event.note} ${event.cancelled}`));

  await mouse.down(C4);

  expect(heard).toEqual(['on 60', 'also on 60', 'off 60 true']);
});

test('destroying from inside a noteon listener still ends the note', async () => {
  const instance = create();
  const heard: string[] = [];
  instance.on('noteon', (event) => {
    heard.push(`on ${event.note}`);
    instance.destroy();
  });
  instance.on('noteoff', (event) => heard.push(`off ${event.note} ${event.cancelled}`));

  await mouse.down(C4);

  expect(heard).toEqual(['on 60', 'off 60 true']);
});

test('a destroyed keyboard ignores every further call', async () => {
  const frames: Frame[] = [];
  const instance = create((ctx, frame) => frames.push(frame));
  await nextFrame();
  const paintedBefore = frames.length;

  instance.destroy();
  instance.destroy();
  instance.update({ range: [0, 127], pressed: [60] });
  instance.redraw();
  instance.focus();
  await mouse.down(C4);
  await nextFrame();

  expect(frames).toHaveLength(paintedBefore);
  expect(document.querySelector('canvas')).toBeNull();
  expect(document.activeElement).toBe(document.body);
});

test('redraw repaints for a painter that reads outside state', async () => {
  const painted: string[] = [];
  let colour = 'red';
  const instance = create(() => painted.push(colour));
  await nextFrame();

  colour = 'blue';
  instance.redraw();
  instance.redraw();

  await expect.poll(() => painted).toEqual(['red', 'blue']);
});

test('several changes in one task repaint once', async () => {
  const frames: Frame[] = [];
  const instance = create((ctx, frame) => frames.push(frame));
  await nextFrame();

  instance.update({ pressed: [60] });
  instance.update({ pressed: [60, 62] });
  instance.update({ highlights: { 64: 'gold' } });
  instance.redraw();
  await nextFrame();
  await nextFrame();

  expect(frames).toHaveLength(2);
  expect(frames[1]?.keys.filter((key) => key.pressed).map((key) => key.note)).toEqual([60, 62]);
});

test('the first frame is painted before the browser shows the canvas', async () => {
  const painted: number[] = [];
  create(() => painted.push(performance.now()));

  expect(painted).toEqual([]);

  await nextFrame();

  expect(painted).toHaveLength(1);
});

test('synthetic pointer events play notes without a real pointer to capture', () => {
  const instance = create();
  const heard: string[] = [];
  instance.on('noteon', (event) => heard.push(`on ${event.note}`));
  instance.on('noteoff', (event) => heard.push(`off ${event.note}`));
  const surface = document.querySelector('canvas')?.parentElement;
  const pointer = { pointerId: 77, button: 0, bubbles: true };

  surface?.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: C4.x, clientY: C4.y }));
  surface?.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: D4.x, clientY: D4.y }));
  surface?.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: D4.x, clientY: D4.y }));

  expect(heard).toEqual(['on 60', 'off 60', 'on 62', 'off 62']);
});

test('keys keep working under a CSS transform on the root', async () => {
  const instance = create();
  const heard: number[] = [];
  instance.on('noteon', (event) => heard.push(event.note));
  const root = document.querySelector('canvas')?.parentElement?.parentElement;
  Object.assign(root?.style ?? {}, { transform: 'scale(0.5)', transformOrigin: '0 0' });

  await mouse.down({ x: 40 + (7.5 * 48) / 2, y: 40 + 70 });

  expect(heard).toEqual([60]);
});

function create(painter?: Painter): KlavierInstance {
  const root = document.createElement('div');
  Object.assign(root.style, { position: 'fixed', left: '40px', top: '40px', width: '720px', height: '160px' });
  document.body.append(root);

  const instance = createKlavier(root, { range: [48, 72], painter });
  instances.push(instance);
  return instance;
}

async function nextFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
