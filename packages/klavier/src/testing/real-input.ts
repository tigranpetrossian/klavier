import { cdp } from 'vitest/browser';

const MODIFIER_BITS: Readonly<Record<string, number>> = { AltLeft: 1, ControlLeft: 2, MetaLeft: 4, ShiftLeft: 8 };
const MOUSE_BUTTON_BITS = { left: 1, right: 2 };
const KEYS: Readonly<Record<string, { key: string; keyCode: number }>> = {
  KeyZ: { key: 'z', keyCode: 90 },
  KeyS: { key: 's', keyCode: 83 },
  KeyX: { key: 'x', keyCode: 88 },
  KeyQ: { key: 'q', keyCode: 81 },
  KeyW: { key: 'w', keyCode: 87 },
  KeyE: { key: 'e', keyCode: 69 },
  Digit2: { key: '2', keyCode: 50 },
  Space: { key: ' ', keyCode: 32 },
  Enter: { key: 'Enter', keyCode: 13 },
  Tab: { key: 'Tab', keyCode: 9 },
  ArrowLeft: { key: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { key: 'ArrowRight', keyCode: 39 },
  Home: { key: 'Home', keyCode: 36 },
  End: { key: 'End', keyCode: 35 },
  AltLeft: { key: 'Alt', keyCode: 18 },
  ControlLeft: { key: 'Control', keyCode: 17 },
  MetaLeft: { key: 'Meta', keyCode: 91 },
  ShiftLeft: { key: 'Shift', keyCode: 16 },
};

interface Point {
  x: number;
  y: number;
}

type MouseButton = keyof typeof MOUSE_BUTTON_BITS;

const pressedMouseButtons = new Set<MouseButton>();
const touches = new Map<number, Point>();
const pressedKeys = new Set<string>();
let mousePosition: Point = { x: 0, y: 0 };

const mouse = {
  async move(point: Point): Promise<void> {
    mousePosition = point;
    // Chromium drops pointer capture on a move that names no button, even with `buttons` set.
    await dispatchMouse('mouseMoved', [...pressedMouseButtons][0] ?? 'none');
  },
  async down(point: Point, button: MouseButton = 'left'): Promise<void> {
    await mouse.move(point);
    pressedMouseButtons.add(button);
    await dispatchMouse('mousePressed', button);
  },
  async up(button: MouseButton = 'left'): Promise<void> {
    pressedMouseButtons.delete(button);
    await dispatchMouse('mouseReleased', button);
  },
};

const touch = {
  async start(id: number, point: Point): Promise<void> {
    touches.set(id, point);
    await dispatchTouch('touchStart', touches);
  },
  async move(id: number, point: Point): Promise<void> {
    if (!touches.has(id)) return;
    touches.set(id, point);
    await dispatchTouch('touchMove', touches);
  },
  async end(id: number): Promise<void> {
    const point = touches.get(id);
    if (!point) return;
    touches.delete(id);
    // Chromium lifts exactly the points listed in a touchEnd and keeps the others down.
    await dispatchTouch('touchEnd', new Map([[id, point]]));
  },
  async cancel(): Promise<void> {
    if (touches.size === 0) return;
    touches.clear();
    await dispatchTouch('touchCancel', touches);
  },
};

const keyboard = {
  async down(code: string): Promise<void> {
    const repeat = pressedKeys.has(code);
    pressedKeys.add(code);
    await dispatchKey('rawKeyDown', code, repeat);
  },
  async up(code: string): Promise<void> {
    pressedKeys.delete(code);
    await dispatchKey('keyUp', code, false);
  },
  async press(code: string): Promise<void> {
    await keyboard.down(code);
    await keyboard.up(code);
  },
};

async function releaseAllInput(): Promise<void> {
  for (const button of [...pressedMouseButtons]) await mouse.up(button);
  await touch.cancel();
  for (const code of [...pressedKeys]) await keyboard.up(code);
}

async function dispatchMouse(
  type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
  button: MouseButton | 'none'
): Promise<void> {
  await cdp().send('Input.dispatchMouseEvent', {
    type,
    button,
    ...toPagePoint(mousePosition),
    buttons: [...pressedMouseButtons].reduce((bits, pressed) => bits | MOUSE_BUTTON_BITS[pressed], 0),
    clickCount: type === 'mouseMoved' ? 0 : 1,
    modifiers: modifierBits(),
  });
}

async function dispatchTouch(
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  points: ReadonlyMap<number, Point>
): Promise<void> {
  await cdp().send('Input.dispatchTouchEvent', {
    type,
    touchPoints: [...points].map(([id, point]) => ({ id, ...toPagePoint(point) })),
    modifiers: modifierBits(),
  });
}

async function dispatchKey(type: 'rawKeyDown' | 'keyUp', code: string, autoRepeat: boolean): Promise<void> {
  const description = KEYS[code];
  if (!description) throw new Error(`real-input has no description for ${code}`);

  await cdp().send('Input.dispatchKeyEvent', {
    type,
    code,
    key: description.key,
    windowsVirtualKeyCode: description.keyCode,
    autoRepeat,
    modifiers: modifierBits(),
  });
}

function modifierBits(): number {
  return [...pressedKeys].reduce((bits, code) => bits | (MODIFIER_BITS[code] ?? 0), 0);
}

function toPagePoint(point: Point): Point {
  const frame = window.frameElement;
  if (!frame) return point;

  const rect = frame.getBoundingClientRect();
  const scale = frame.clientWidth === 0 ? 1 : rect.width / frame.clientWidth;
  return { x: rect.left + point.x * scale, y: rect.top + point.y * scale };
}

export { mouse, touch, keyboard, releaseAllInput };
export type { Point };
