import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { mountCore } from './testing/mount-core';
import { mountReact } from './testing/mount-react';
import { paintedPressedNotes, pressedButtonNotes, soundingNotes, unmountEverything } from './testing/mounted';
import { keyboard, mouse, releaseAllInput, touch } from './testing/real-input';
import type { KlavierOptions } from './klavier-types';
import type { Mount, Mounted, NoteLogEntry } from './testing/mounted';
import type { Point } from './testing/real-input';

const MOUNTS: ReadonlyArray<readonly [string, Mount]> = [
  ['createKlavier', mountCore],
  ['<Klavier>', mountReact],
];
const HOST = { left: 40, top: 40, width: 720, height: 160 };
const RANGES: ReadonlyArray<readonly [number, number]> = [
  [48, 72],
  [60, 71],
  [36, 96],
  [61, 63],
];
const KEY_CODES = ['KeyZ', 'KeyS', 'KeyE', 'Space', 'Enter', 'ArrowRight', 'Tab', 'MetaLeft'];
const FINGERS = [0, 1, 2];
const ASSISTIVE_CLICK_SETTLE_MS = 1000;
const GENEROUS_TIMEOUT_MS = 90_000;

type Operation =
  | { kind: 'mouseDown' | 'mouseMove'; at: Point }
  | { kind: 'mouseUp' }
  | { kind: 'touchStart' | 'touchMove'; finger: number; at: Point }
  | { kind: 'touchEnd'; finger: number }
  | { kind: 'touchCancel' }
  | { kind: 'keyDown' | 'keyUp'; code: string }
  | { kind: 'focusKeys' | 'focusElsewhere' }
  | { kind: 'assistiveClick'; key: number }
  | { kind: 'update'; patch: KlavierOptions };

interface Session {
  mounted: Mounted;
  elsewhere: HTMLButtonElement;
  range: readonly [number, number];
  appPressed: readonly number[];
  mouseIsDown: boolean;
  fingersDown: Set<number>;
  keysDown: Set<string>;
  assistiveClicks: number;
}

const pointInOrNearHost: fc.Arbitrary<Point> = fc.record({
  x: fc.double({ min: -0.05, max: 1.05, noNaN: true }),
  y: fc.double({ min: -0.2, max: 1.2, noNaN: true }),
});

const patch: fc.Arbitrary<KlavierOptions> = fc.oneof(
  fc.constantFrom(...RANGES).map((range) => ({ range })),
  fc.boolean().map((interactive) => ({ interactive })),
  fc.constantFrom<KlavierOptions['computerKeyboard']>('focus', 'global', 'off').map((computerKeyboard) => ({
    computerKeyboard,
  })),
  fc.constantFrom(36, 48, 60).map((keymapBase) => ({ keymapBase })),
  fc.uniqueArray(fc.integer({ min: 58, max: 66 }), { maxLength: 3 }).map((pressed) => ({ pressed }))
);

const operation: fc.Arbitrary<Operation> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constantFrom('mouseDown', 'mouseMove'), at: pointInOrNearHost }) },
  { weight: 2, arbitrary: fc.constant<Operation>({ kind: 'mouseUp' }) },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constantFrom('touchStart', 'touchMove'),
      finger: fc.constantFrom(...FINGERS),
      at: pointInOrNearHost,
    }),
  },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('touchEnd'), finger: fc.constantFrom(...FINGERS) }) },
  { weight: 1, arbitrary: fc.constant<Operation>({ kind: 'touchCancel' }) },
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('keyDown'), code: fc.constantFrom(...KEY_CODES) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('keyUp'), code: fc.constantFrom(...KEY_CODES) }) },
  { weight: 2, arbitrary: fc.constant<Operation>({ kind: 'focusKeys' }) },
  { weight: 2, arbitrary: fc.constant<Operation>({ kind: 'focusElsewhere' }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('assistiveClick'), key: fc.nat({ max: 60 }) }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('update'), patch }) }
);

describe.each(MOUNTS)('%s', (name, mount) => {
  test('no input sequence leaves a note stuck or unpaired', { timeout: GENEROUS_TIMEOUT_MS }, async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(operation, { minLength: 10, maxLength: 60 }), async (operations) => {
        const session = await openSession(mount);

        try {
          for (const step of operations) {
            await perform(session, step);
            expectConsistent(session, step);
          }

          await releaseAllInput();
          await expect
            .poll(() => soundingNotes(session.mounted.log), { timeout: ASSISTIVE_CLICK_SETTLE_MS })
            .toEqual([]);
          await expect.poll(() => paintedPressedNotes(session.mounted)).toEqual(appPressedOnKeys(session));

          await session.mounted.unmount();
          expect(unpairedNotes(session.mounted.log)).toEqual([]);
        } finally {
          await releaseAllInput();
          await unmountEverything();
        }
      }),
      { numRuns: 25 }
    );
  });
});

async function openSession(mount: Mount): Promise<Session> {
  const elsewhere = document.createElement('button');
  document.body.append(elsewhere);

  return {
    mounted: await mount(),
    elsewhere,
    range: [48, 72],
    appPressed: [],
    mouseIsDown: false,
    fingersDown: new Set(),
    keysDown: new Set(),
    assistiveClicks: 0,
  };
}

async function perform(session: Session, step: Operation): Promise<void> {
  switch (step.kind) {
    case 'mouseDown':
      session.mouseIsDown = true;
      return mouse.down(inHost(step.at));
    case 'mouseMove':
      return mouse.move(inHost(step.at));
    case 'mouseUp':
      session.mouseIsDown = false;
      return mouse.up();
    case 'touchStart':
      session.fingersDown.add(step.finger);
      return touch.start(step.finger, inHost(step.at));
    case 'touchMove':
      return touch.move(step.finger, inHost(step.at));
    case 'touchEnd':
      session.fingersDown.delete(step.finger);
      return touch.end(step.finger);
    case 'touchCancel':
      session.fingersDown.clear();
      return touch.cancel();
    case 'keyDown':
      session.keysDown.add(step.code);
      return keyboard.down(step.code);
    case 'keyUp':
      session.keysDown.delete(step.code);
      return keyboard.up(step.code);
    case 'focusKeys':
      return session.mounted.focus();
    case 'focusElsewhere':
      return session.elsewhere.focus();
    case 'assistiveClick': {
      const buttons = session.mounted.host.querySelectorAll('button');
      if (buttons.length > 0) session.assistiveClicks += 1;
      return buttons[step.key % Math.max(1, buttons.length)]?.click();
    }
    case 'update':
      session.range = step.patch.range ?? session.range;
      session.appPressed = step.patch.pressed ? [...step.patch.pressed] : session.appPressed;
      return session.mounted.update(step.patch);
  }
}

function expectConsistent(session: Session, after: Operation): void {
  const { mounted } = session;
  const sounding = soundingNotes(mounted.log);
  const [first, last] = session.range;
  const hasButtons = mounted.host.querySelector('button') !== null;
  const shown = [...new Set([...sounding, ...appPressedOnKeys(session)])].sort((a, b) => a - b);
  const nothingHeld =
    !session.mouseIsDown &&
    session.fingersDown.size === 0 &&
    session.keysDown.size === 0 &&
    session.assistiveClicks === 0;

  expect(misorderedNotes(mounted.log), `event order after ${after.kind}`).toEqual([]);
  expect(
    sounding.filter((note) => note < first || note > last),
    `notes outside the range after ${after.kind}`
  ).toEqual([]);
  expect(pressedButtonNotes(mounted), `aria-pressed after ${after.kind}`).toEqual(hasButtons ? shown : []);
  if (nothingHeld) expect(sounding, `sounding with nothing held after ${after.kind}`).toEqual([]);
}

function appPressedOnKeys(session: Session): number[] {
  const [first, last] = session.range;
  return session.appPressed.filter((note) => note >= first && note <= last).sort((a, b) => a - b);
}

function inHost(at: Point): Point {
  return { x: HOST.left + at.x * HOST.width, y: HOST.top + at.y * HOST.height };
}

function misorderedNotes(log: readonly NoteLogEntry[]): string[] {
  const sounding = new Set<number>();
  const misordered: string[] = [];

  for (const entry of log) {
    const expectedSounding = entry.type === 'noteoff';
    if (sounding.has(entry.note) !== expectedSounding) misordered.push(`${entry.type} ${entry.note}`);
    if (entry.type === 'noteon') sounding.add(entry.note);
    else sounding.delete(entry.note);
  }
  return misordered;
}

function unpairedNotes(log: readonly NoteLogEntry[]): string[] {
  const noteOns = log.filter((entry) => entry.type === 'noteon').length;
  const noteOffs = log.filter((entry) => entry.type === 'noteoff').length;
  const unpaired = [...misorderedNotes(log), ...soundingNotes(log).map((note) => `stuck ${note}`)];
  return noteOns === noteOffs ? unpaired : [...unpaired, `${noteOns} noteon but ${noteOffs} noteoff`];
}
