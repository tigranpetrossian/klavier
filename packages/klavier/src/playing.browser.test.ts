import { afterEach, describe, expect, test, vi } from 'vitest';
import { layoutKeys } from './layout-keys';
import { mountCore } from './testing/mount-core';
import { mountReact } from './testing/mount-react';
import {
  TEST_RANGE,
  keyButton,
  keysRect,
  lastFrame,
  paintedPressedNotes,
  pointOnKey,
  pressedButtonNotes,
  unmountEverything,
} from './testing/mounted';
import { keyboard, mouse, releaseAllInput, touch } from './testing/real-input';
import type { Painter } from './klavier-types';
import type { Mount, NoteLogEntry } from './testing/mounted';

const MOUNTS: ReadonlyArray<readonly [string, Mount]> = [
  ['createKlavier', mountCore],
  ['<Klavier>', mountReact],
];

afterEach(async () => {
  await releaseAllInput();
  await unmountEverything();
});

describe.each(MOUNTS)('%s', (name, mount) => {
  describe('painting', () => {
    test('the painter gets a frame of the laid-out keys, all at rest', async () => {
      const mounted = await mount();

      const expected = layoutKeys({ range: TEST_RANGE, width: 720, height: 160, pixelRatio: devicePixelRatio });
      expect(lastFrame(mounted)).toEqual({
        width: 720,
        height: 160,
        pixelRatio: devicePixelRatio,
        keys: expected.keys.map((key) => ({ ...key, pressed: false, highlight: undefined })),
      });
    });

    test('the canvas is backed by one bitmap pixel per device pixel', async () => {
      const mounted = await mount();

      const canvas = mounted.host.querySelector('canvas');
      expect([canvas?.width, canvas?.height]).toEqual([720 * devicePixelRatio, 160 * devicePixelRatio]);
    });

    test('pressed and highlights show on the keys without playing them', async () => {
      const mounted = await mount({ pressed: [60, 64], highlights: { 62: 'tomato' } });

      expect(paintedPressedNotes(mounted)).toEqual([60, 64]);
      expect(lastFrame(mounted)?.keys.find((key) => key.note === 62)?.highlight).toBe('tomato');
      expect(pressedButtonNotes(mounted)).toEqual([60, 64]);

      await mounted.update({ pressed: [67], highlights: {} });

      await expect.poll(() => paintedPressedNotes(mounted)).toEqual([67]);
      expect(lastFrame(mounted)?.keys.find((key) => key.note === 62)?.highlight).toBeUndefined();
      expect(pressedButtonNotes(mounted)).toEqual([67]);
      expect(mounted.log).toEqual([]);
    });

    test('a note held by the user stays pressed when the app releases it', async () => {
      const mounted = await mount({ pressed: [60] });

      await mouse.down(pointOnKey(mounted, 60));
      await mounted.update({ pressed: [] });

      expect(pressedButtonNotes(mounted)).toEqual([60]);

      await mouse.up();

      expect(pressedButtonNotes(mounted)).toEqual([]);
    });

    test('the overlay is painted after the painter, on the same frame', async () => {
      const calls: string[] = [];
      const painter: Painter = (ctx, frame) => calls.push(`painter ${frame.keys.length}`);
      const overlay: Painter = (ctx, frame) => calls.push(`overlay ${frame.keys.length}`);

      await mount({ painter, overlay });

      expect(calls).toEqual(['painter 25', 'overlay 25']);
    });

    test('canvas state set by the painter does not leak into the overlay', async () => {
      const seen: string[] = [];
      const painter: Painter = (ctx) => {
        ctx.fillStyle = '#ff0000';
        ctx.translate(10, 10);
      };
      const overlay: Painter = (ctx) => seen.push(`${ctx.fillStyle} ${ctx.getTransform().e}`);

      await mount({ painter, overlay });

      expect(seen).toEqual(['#000000 0']);
    });

    test('an update that changes nothing does not repaint', async () => {
      const highlights = { 60: 'gold' };
      const mounted = await mount({ pressed: [62], highlights });
      const paintedBefore = mounted.frames.length;

      await mounted.update({ pressed: [62], highlights: { 60: 'gold' }, range: [48, 72] });
      await nextFrames(2);

      expect(mounted.frames).toHaveLength(paintedBefore);
    });
  });

  describe('sizing', () => {
    test('a host with only a width gets its height from the keys', async () => {
      const mounted = await mount({ range: [60, 71] }, { style: { width: '470px' } });

      const { width, height } = keysRect(mounted);
      expect([width, Math.round(height)]).toEqual([470, Math.round(470 / ((7 * 23.5) / 150))]);
    });

    test.each(['flex', 'grid'])(
      'keys wider than a fixed-height %s container shrink to fit instead of stretching it',
      async (display) => {
        const container = document.createElement('div');
        Object.assign(container.style, { display, width: '300px', height: '90px' });
        document.body.append(container);
        const mounted = await mount({ range: undefined }, { style: { flex: '1' }, container });

        await expect.poll(() => lastFrame(mounted)).toMatchObject({ width: 300, height: 90 });
        expect([keysRect(mounted).width, keysRect(mounted).height]).toEqual([300, 90]);
        expect(mounted.host.getBoundingClientRect().width).toBe(300);
      }
    );

    test('resizing the host lays the keys out again', async () => {
      const mounted = await mount();

      mounted.host.style.width = '360px';

      await expect.poll(() => mounted.layout().width).toBe(360);
      expect(mounted.layouts.at(-1)).toEqual(
        layoutKeys({ range: TEST_RANGE, width: 360, height: 160, pixelRatio: devicePixelRatio })
      );
      expect(lastFrame(mounted)?.width).toBe(360);
      expect(keyButton(mounted, 72)?.getBoundingClientRect().right).toBeCloseTo(40 + 360, 1);
    });

    test('a host without size paints nothing until it gets one', async () => {
      const mounted = await mount({}, { style: { width: '0px', height: '0px' } });

      expect(mounted.frames).toEqual([]);

      Object.assign(mounted.host.style, { width: '300px', height: '80px' });

      await expect.poll(() => lastFrame(mounted)).toMatchObject({ width: 300, height: 80 });
    });

    test('a huge keyboard lowers the bitmap resolution instead of exceeding the canvas area limit', async () => {
      const mounted = await mount({}, { style: { position: 'fixed', width: '8000px', height: '3000px' } });

      const canvas = mounted.host.querySelector('canvas');
      expect((canvas?.width ?? 0) * (canvas?.height ?? 0)).toBeLessThanOrEqual(16_777_216);
      expect(lastFrame(mounted)?.pixelRatio).toBeLessThan(devicePixelRatio);
      expect(lastFrame(mounted)?.width).toBeCloseTo(8000, 0);
    });
  });

  describe('mouse', () => {
    test('pressing and releasing a key plays one note', async () => {
      const mounted = await mount();

      await mouse.down(pointOnKey(mounted, 60, { x: 0.5, y: 0.8 }));

      expect(mounted.log).toEqual([
        {
          type: 'noteon',
          note: 60,
          source: 'pointer',
          velocity: expect.closeTo(0.85, 3),
          keyX: expect.closeTo(0.5, 3),
          keyY: expect.closeTo(0.8, 3),
        },
      ]);
      expect(keyButton(mounted, 60)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => paintedPressedNotes(mounted)).toEqual([60]);

      await mouse.up();

      expect(mounted.log.at(-1)).toEqual({ type: 'noteoff', note: 60, cancelled: false });
      expect(mounted.log).toHaveLength(2);
      expect(keyButton(mounted, 60)).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(() => paintedPressedNotes(mounted)).toEqual([]);
    });

    test('a black key wins where it covers a white key', async () => {
      const mounted = await mount();
      const overWhiteKeyUnderBlackKey = pointOnKey(mounted, 60, { x: 0.9, y: 0.3 });

      await mouse.down(overWhiteKeyUnderBlackKey);

      expect(notesOf(mounted.log, 'noteon')).toEqual([61]);
    });

    test('a press is quiet at the top of a key and loud at the bottom', async () => {
      const mounted = await mount();

      await mouse.down(pointOnKey(mounted, 62, { x: 0.5, y: 0.02 }));
      await mouse.up();
      await mouse.down(pointOnKey(mounted, 62, { x: 0.5, y: 0.98 }));

      expect(mounted.log.filter(isNoteOn).map((entry) => entry.velocity)).toEqual([
        expect.closeTo(0.265, 2),
        expect.closeTo(0.985, 2),
      ]);
    });

    test('dragging across keys is a glissando', async () => {
      const mounted = await mount();

      await mouse.down(pointOnKey(mounted, 60));
      await mouse.move(pointOnKey(mounted, 62));
      await mouse.move(pointOnKey(mounted, 62, { x: 0.6, y: 0.9 }));
      await mouse.move(pointOnKey(mounted, 64));
      await mouse.up();

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60', 'on 62', 'off 62', 'on 64', 'off 64']);
    });

    test('dragging off the keys releases the note and dragging back plays again', async () => {
      const mounted = await mount();
      const belowTheKeys = { x: pointOnKey(mounted, 60).x, y: keysRect(mounted).bottom + 30 };

      await mouse.down(pointOnKey(mounted, 60));
      await mouse.move(belowTheKeys);

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
      expect(pressedButtonNotes(mounted)).toEqual([]);

      await mouse.move(pointOnKey(mounted, 62));
      await mouse.up();

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60', 'on 62', 'off 62']);
    });

    test('moving the mouse over the keys without a button down plays nothing', async () => {
      const mounted = await mount();

      await mouse.move(pointOnKey(mounted, 60));
      await mouse.move(pointOnKey(mounted, 64));

      expect(mounted.log).toEqual([]);
    });

    test('the right button plays nothing and opens no context menu', async () => {
      const mounted = await mount();
      const contextMenus: boolean[] = [];
      window.addEventListener('contextmenu', (event) => contextMenus.push(event.defaultPrevented), { once: true });

      await mouse.down(pointOnKey(mounted, 60), 'right');
      await mouse.up('right');

      expect(mounted.log).toEqual([]);
      expect(contextMenus).toEqual([true]);
    });

    test('a pressed key takes focus without a focus ring, even after keyboard focus showed one', async () => {
      const before = appendButton('before');
      const mounted = await mount();
      before.focus();
      await keyboard.press('Tab');

      expect(document.activeElement?.matches(':focus-visible')).toBe(true);

      await mouse.down(pointOnKey(mounted, 64));

      expect(document.activeElement).toBe(keyButton(mounted, 64));
      expect(keyButton(mounted, 64)?.matches(':focus-visible')).toBe(false);
    });

    test('a pointer that another element captures ends its note as cancelled', async () => {
      const mounted = await mount();
      await mouse.down(pointOnKey(mounted, 60));
      const pointerId = await nextPointerId(() => mouse.move(pointOnKey(mounted, 60, { x: 0.6, y: 0.85 })));

      document.body.setPointerCapture(pointerId);
      await mouse.move(pointOnKey(mounted, 62));
      await mouse.up();

      expect(mounted.log.map(summary)).toEqual(['on 60', 'cancel 60']);
    });

    test('a keyboard that is not interactive ignores the mouse and has no key buttons', async () => {
      const mounted = await mount({ interactive: false });

      await mouse.down(pointOnKey(mounted, 60));
      await mouse.up();

      expect(mounted.log).toEqual([]);
      expect(mounted.host.querySelectorAll('button')).toHaveLength(0);
    });
  });

  describe('touch', () => {
    test('two fingers hold two notes and each ends its own', async () => {
      const mounted = await mount();

      await touch.start(0, pointOnKey(mounted, 60));
      await touch.start(1, pointOnKey(mounted, 64));

      expect(pressedButtonNotes(mounted)).toEqual([60, 64]);

      await touch.end(0);

      expect(pressedButtonNotes(mounted)).toEqual([64]);

      await touch.end(1);

      expect(mounted.log.map(summary)).toEqual(['on 60', 'on 64', 'off 60', 'off 64']);
    });

    test('a note held by two fingers ends when the last one lifts', async () => {
      const mounted = await mount();

      await touch.start(0, pointOnKey(mounted, 60, { x: 0.3, y: 0.85 }));
      await touch.start(1, pointOnKey(mounted, 60, { x: 0.7, y: 0.85 }));
      await touch.end(0);

      expect(mounted.log.map(summary)).toEqual(['on 60']);

      await touch.end(1);

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });

    test('each finger slides its own glissando', async () => {
      const mounted = await mount();

      await touch.start(0, pointOnKey(mounted, 60));
      await touch.start(1, pointOnKey(mounted, 67));
      await touch.move(0, pointOnKey(mounted, 62));
      await touch.move(1, pointOnKey(mounted, 69));

      expect(pressedButtonNotes(mounted)).toEqual([62, 69]);
      expect(mounted.log.map(summary)).toEqual(['on 60', 'on 67', 'off 60', 'on 62', 'off 67', 'on 69']);
    });

    test('a cancelled touch ends its note as cancelled', async () => {
      const mounted = await mount();

      await touch.start(0, pointOnKey(mounted, 60));
      await touch.cancel();

      expect(mounted.log.at(-1)).toEqual({ type: 'noteoff', note: 60, cancelled: true });
    });

    test('touchAction decides which touch gestures the browser keeps', async () => {
      const mounted = await mount({ touchAction: 'pan-x' });
      const surface = mounted.host.querySelector('canvas')?.parentElement;

      expect(surface?.style.touchAction).toBe('pan-x');

      await mounted.update({ touchAction: undefined });

      expect(surface?.style.touchAction).toBe('none');
    });
  });

  describe('computer keyboard', () => {
    test('plays mapped keys only while the keyboard has focus', async () => {
      const mounted = await mount();

      await keyboard.press('KeyQ');

      expect(mounted.log).toEqual([]);

      mounted.focus();
      await keyboard.down('KeyQ');

      expect(mounted.log).toEqual([{ type: 'noteon', note: 60, source: 'keyboard', velocity: 0.75 }]);
      expect(pressedButtonNotes(mounted)).toEqual([60]);

      await keyboard.up('KeyQ');

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });

    test('a held key does not retrigger while it repeats', async () => {
      const mounted = await mount();
      mounted.focus();

      await keyboard.down('KeyZ');
      await keyboard.down('KeyZ');
      await keyboard.down('KeyZ');
      await keyboard.up('KeyZ');

      expect(mounted.log.map(summary)).toEqual(['on 48', 'off 48']);
    });

    test('a key held through an octave shift releases the note it started', async () => {
      const mounted = await mount();
      mounted.focus();

      await keyboard.down('KeyZ');
      await mounted.update({ keymapBase: 60 });
      await keyboard.up('KeyZ');
      await keyboard.press('KeyZ');

      expect(mounted.log.map(summary)).toEqual(['on 48', 'off 48', 'on 60', 'off 60']);
    });

    test('a custom keymap replaces the default and notes outside the range stay silent', async () => {
      const mounted = await mount({ keymap: { KeyW: 0, KeyE: 40 }, keymapBase: 50 });
      mounted.focus();

      await keyboard.press('KeyQ');
      await keyboard.press('KeyE');
      await keyboard.press('KeyW');

      expect(mounted.log.map(summary)).toEqual(['on 50', 'off 50']);
    });

    test('pressing Command cancels held keys, because their keyup may never come', async () => {
      const mounted = await mount();
      mounted.focus();

      await keyboard.down('KeyQ');
      await keyboard.down('MetaLeft');

      expect(mounted.log.at(-1)).toEqual({ type: 'noteoff', note: 60, cancelled: true });

      await keyboard.up('KeyQ');
      await keyboard.up('MetaLeft');

      expect(mounted.log.map(summary)).toEqual(['on 60', 'cancel 60']);
    });

    test('keys pressed with Control or Alt are left to the browser', async () => {
      const mounted = await mount();
      mounted.focus();

      await keyboard.down('ControlLeft');
      await keyboard.press('KeyQ');
      await keyboard.up('ControlLeft');
      await keyboard.down('AltLeft');
      await keyboard.press('KeyQ');
      await keyboard.up('AltLeft');

      expect(mounted.log).toEqual([]);
    });

    test('moving focus away cancels held keys', async () => {
      const mounted = await mount();
      const elsewhere = appendButton('elsewhere');
      mounted.focus();

      await keyboard.down('KeyQ');
      elsewhere.focus();

      expect(mounted.log.at(-1)).toEqual({ type: 'noteoff', note: 60, cancelled: true });

      await keyboard.up('KeyQ');

      expect(mounted.log.map(summary)).toEqual(['on 60', 'cancel 60']);
    });

    test('global mode plays without focus but not while typing in a text field', async () => {
      const mounted = await mount({ computerKeyboard: 'global' });
      const field = document.createElement('input');
      document.body.append(field);

      await keyboard.press('KeyQ');

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);

      field.focus();
      await keyboard.press('KeyQ');

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });

    test('global mode releases a key whose keyup lands in a text field', async () => {
      const mounted = await mount({ computerKeyboard: 'global' });
      const field = document.createElement('input');
      document.body.append(field);

      await keyboard.down('KeyQ');
      field.focus();
      await keyboard.up('KeyQ');

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });

    test('global mode sees through shadow roots to the text field', async () => {
      const mounted = await mount({ computerKeyboard: 'global' });
      const shadowHost = document.createElement('div');
      const field = document.createElement('input');
      shadowHost.attachShadow({ mode: 'open' }).append(field);
      document.body.append(shadowHost);

      field.focus();
      await keyboard.press('KeyQ');

      expect(mounted.log).toEqual([]);
    });

    test('off ignores mapped keys', async () => {
      const mounted = await mount({ computerKeyboard: 'off' });
      mounted.focus();

      await keyboard.press('KeyQ');

      expect(mounted.log).toEqual([]);
    });

    test('switching mode cancels keys held under the old one', async () => {
      const mounted = await mount();
      mounted.focus();

      await keyboard.down('KeyQ');
      await mounted.update({ computerKeyboard: 'off' });

      expect(mounted.log.at(-1)).toEqual({ type: 'noteoff', note: 60, cancelled: true });
    });
  });

  describe('accessibility', () => {
    test('every key is a named toggle button', async () => {
      const mounted = await mount({ range: [60, 62] });

      const buttons = [...mounted.host.querySelectorAll('button')];
      expect(buttons.map((button) => [button.getAttribute('aria-label'), button.getAttribute('aria-pressed')])).toEqual(
        [
          ['C4', 'false'],
          ['C sharp 4', 'false'],
          ['D4', 'false'],
        ]
      );
    });

    test('keyName names the keys and renames them when it changes', async () => {
      const mounted = await mount({ range: [60, 61], keyName: (note) => `Note ${note}` });

      expect(keyButton(mounted, 61)).toHaveAttribute('aria-label', 'Note 61');

      await mounted.update({ keyName: (note) => `Taste ${note}` });

      expect(keyButton(mounted, 61)).toHaveAttribute('aria-label', 'Taste 61');
    });

    test('key buttons sit exactly over their keys, black above white', async () => {
      const mounted = await mount();
      const blackKey = mounted.layout().keys.find((key) => key.note === 61);
      const rect = keyButton(mounted, 61)?.getBoundingClientRect();

      expect([rect?.left, rect?.top, rect?.width, rect?.height]).toEqual([
        expect.closeTo(40 + (blackKey?.x ?? 0), 1),
        40,
        expect.closeTo(blackKey?.width ?? 0, 1),
        expect.closeTo(blackKey?.height ?? 0, 1),
      ]);
      expect(document.elementFromPoint(...asTuple(pointOnKey(mounted, 61, { x: 0.5, y: 0.5 })))).toBe(
        keyButton(mounted, 61)
      );
    });

    test('the whole keyboard is one tab stop', async () => {
      const before = appendButton('before');
      const mounted = await mount();
      const after = appendButton('after');
      before.focus();

      await keyboard.press('Tab');

      expect(document.activeElement).toBe(keyButton(mounted, 48));
      expect(keyButton(mounted, 48)?.matches(':focus-visible')).toBe(true);

      await keyboard.press('Tab');

      expect(document.activeElement).toBe(after);
    });

    test('arrow keys, Home and End move focus between keys and the tab stop follows', async () => {
      const before = appendButton('before');
      const mounted = await mount();
      mounted.focus();

      await keyboard.press('ArrowRight');
      await keyboard.press('ArrowRight');

      expect(document.activeElement).toBe(keyButton(mounted, 50));

      await keyboard.press('ArrowLeft');

      expect(document.activeElement).toBe(keyButton(mounted, 49));

      await keyboard.press('End');
      await keyboard.press('ArrowRight');

      expect(document.activeElement).toBe(keyButton(mounted, 72));

      await keyboard.press('Home');
      await keyboard.press('ArrowLeft');
      await keyboard.press('ArrowRight');
      before.focus();
      await keyboard.press('Tab');

      expect(document.activeElement).toBe(keyButton(mounted, 49));
    });

    test.each(['Space', 'Enter'])('%s plays the focused key for as long as it is held', async (code) => {
      const mounted = await mount();
      mounted.focus();
      await keyboard.press('ArrowRight');

      await keyboard.down(code);
      await keyboard.down(code);

      expect(mounted.log).toEqual([{ type: 'noteon', note: 49, source: 'keyboard', velocity: 0.75 }]);
      expect(keyButton(mounted, 49)).toHaveAttribute('aria-pressed', 'true');

      await keyboard.up(code);
      await vi.waitFor(() => expect(mounted.log.map(summary)).toEqual(['on 49', 'off 49']));
      await nextFrames(2);

      expect(mounted.log).toHaveLength(2);
    });

    test('releasing Space while the mouse holds a key does not play it again', async () => {
      const mounted = await mount();

      await mouse.down(pointOnKey(mounted, 60));
      await keyboard.up('Space');
      await mouse.up();

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });

    test('Space still plays the focused key when the computer keyboard is off', async () => {
      const mounted = await mount({ computerKeyboard: 'off' });
      mounted.focus();

      await keyboard.press('Space');

      expect(mounted.log.map(summary)).toEqual(['on 48', 'off 48']);
    });

    test('a click from assistive technology plays the key briefly', async () => {
      const mounted = await mount();

      keyButton(mounted, 60)?.click();

      expect(mounted.log).toEqual([{ type: 'noteon', note: 60, source: 'keyboard', velocity: 0.75 }]);
      expect(keyButton(mounted, 60)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });

    test('a mouse click is not played a second time as an assistive click', async () => {
      const mounted = await mount();

      await mouse.down(pointOnKey(mounted, 60));
      await mouse.up();
      await nextFrames(2);

      expect(mounted.log.map(summary)).toEqual(['on 60', 'off 60']);
    });
  });

  describe('changing the keys', () => {
    test('a new range cancels notes being played and lays the new keys out', async () => {
      const mounted = await mount();
      mounted.focus();
      await mouse.down(pointOnKey(mounted, 60));
      await keyboard.down('KeyZ');

      await mounted.update({ range: [60, 71] });

      expect(mounted.log.map(summary)).toEqual(['on 60', 'on 48', 'cancel 60', 'cancel 48']);
      expect(mounted.layouts.at(-1)).toEqual(
        layoutKeys({ range: [60, 71], width: 720, height: 160, pixelRatio: devicePixelRatio })
      );
      expect(mounted.host.querySelectorAll('button')).toHaveLength(12);
      expect(pressedButtonNotes(mounted)).toEqual([]);

      await mouse.move(pointOnKey(mounted, 62));
      await mouse.up();
      await keyboard.up('KeyZ');

      expect(mounted.log).toHaveLength(4);
    });

    test('focus stays on the keyboard when the range changes under it', async () => {
      const mounted = await mount();
      mounted.focus();
      await keyboard.press('End');

      await mounted.update({ range: [48, 60] });

      expect(document.activeElement).toBe(keyButton(mounted, 48));
    });

    test('turning interactivity off cancels notes being played and removes the key buttons', async () => {
      const mounted = await mount();
      await mouse.down(pointOnKey(mounted, 60));

      await mounted.update({ interactive: false });

      expect(mounted.log.map(summary)).toEqual(['on 60', 'cancel 60']);
      expect(mounted.host.querySelectorAll('button')).toHaveLength(0);

      await mouse.up();
      await mounted.update({ interactive: true });
      await mouse.down(pointOnKey(mounted, 62));

      expect(mounted.log.map(summary)).toEqual(['on 60', 'cancel 60', 'on 62']);
    });

    test('blackKeyLength changes the layout', async () => {
      const mounted = await mount();

      await mounted.update({ blackKeyLength: 0.5 });

      expect(mounted.layout().keys.find((key) => key.note === 61)?.height).toBe(80);
      await expect.poll(() => lastFrame(mounted)?.keys.find((key) => key.note === 61)?.height).toBe(80);
    });

    test('unmounting cancels notes being played and removes everything it added', async () => {
      const mounted = await mount();
      await mouse.down(pointOnKey(mounted, 60));
      await touch.start(0, pointOnKey(mounted, 64));

      await mounted.unmount();

      expect(mounted.log.map(summary)).toEqual(['on 60', 'on 64', 'cancel 60', 'cancel 64']);
      expect(document.querySelector('canvas')).toBeNull();
    });
  });

  describe('never throws', () => {
    test.each([[[Number.NaN, 3]], [[90, 30]], [[-40, 400]], [[60.4, 60.4]]])(
      'an invalid range %j still makes a playable keyboard',
      async (range) => {
        const mounted = await mount({ range: [range[0] ?? 0, range[1] ?? 0] });
        const firstNote = mounted.layout().range[0];

        await mouse.down(pointOnKey(mounted, firstNote));

        expect(notesOf(mounted.log, 'noteon')).toEqual([firstNote]);
      }
    );

    test('without a 2D context the keys still play', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      const mounted = await mount();
      vi.restoreAllMocks();

      await mouse.down(pointOnKey(mounted, 60));

      expect(mounted.frames).toEqual([]);
      expect(mounted.log.map(summary)).toEqual(['on 60']);
      expect(pressedButtonNotes(mounted)).toEqual([60]);
    });
  });
});

function summary(entry: NoteLogEntry): string {
  if (entry.type === 'noteon') return `on ${entry.note}`;
  return `${entry.cancelled ? 'cancel' : 'off'} ${entry.note}`;
}

function isNoteOn(entry: NoteLogEntry): entry is Extract<NoteLogEntry, { type: 'noteon' }> {
  return entry.type === 'noteon';
}

function notesOf(log: readonly NoteLogEntry[], type: NoteLogEntry['type']): number[] {
  return log.filter((entry) => entry.type === type).map((entry) => entry.note);
}

function appendButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  document.body.append(button);
  return button;
}

async function nextPointerId(act: () => Promise<void>): Promise<number> {
  const pointerIds: number[] = [];
  window.addEventListener('pointermove', (event) => pointerIds.push(event.pointerId), { once: true, capture: true });
  await act();
  return pointerIds[0] ?? -1;
}

function asTuple(point: { x: number; y: number }): [number, number] {
  return [point.x, point.y];
}

async function nextFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}
