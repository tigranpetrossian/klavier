import { expect, test } from 'vitest';
import { stepBoundary, type InputSignal } from './step-boundaries.ts';

const POINTER: InputSignal = { kind: 'pointer' };
const NUDGE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];

test.each(NUDGE_KEYS)('a first %s closes the step and starts a nudge', (name) => {
  expect(stepBoundary(key(name), false)).toEqual({ closes: true, afterNudge: true });
});

test.each(NUDGE_KEYS)('%s after a nudge keeps the step open', (name) => {
  expect(stepBoundary(key(name), true)).toEqual({ closes: false, afterNudge: true });
});

test.each([
  ['a pointerdown', POINTER, false, { closes: true, afterNudge: false }],
  ['a pointerdown after a nudge', POINTER, true, { closes: true, afterNudge: false }],
  ['Shift', key('Shift'), false, { closes: false, afterNudge: false }],
  ['Shift after a nudge', key('Shift'), true, { closes: false, afterNudge: true }],
  ['Alt', key('Alt'), true, { closes: false, afterNudge: true }],
  ['Control', key('Control'), false, { closes: false, afterNudge: false }],
  ['Meta', key('Meta'), true, { closes: false, afterNudge: true }],
  ['CapsLock', key('CapsLock'), false, { closes: false, afterNudge: false }],
  ['AltGraph', key('AltGraph'), true, { closes: false, afterNudge: true }],
  ['Enter', key('Enter'), false, { closes: true, afterNudge: false }],
  ['Enter after a nudge', key('Enter'), true, { closes: true, afterNudge: false }],
  ['a letter after a nudge', key('a'), true, { closes: true, afterNudge: false }],
  ['Tab after a nudge', key('Tab'), true, { closes: true, afterNudge: false }],
  ['Escape', key('Escape'), false, { closes: true, afterNudge: false }],
])('%s', (_, signal, afterNudge, boundary) => {
  expect(stepBoundary(signal, afterNudge)).toEqual(boundary);
});

function key(name: string): InputSignal {
  return { kind: 'key', key: name };
}
