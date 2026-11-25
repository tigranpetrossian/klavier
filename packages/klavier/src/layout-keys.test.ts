import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { layoutKeys } from './layout-keys';
import type { KeyRect, KlavierLayout } from './layout-keys';

const PIXEL_RATIOS = [1, 1.25, 1.5, 2];
const BLACK_PITCH_CLASSES = [1, 3, 6, 8, 10];
const BLACK_KEY_WIDTH_IN_WHITE_KEYS = 7 / 12;
const BLACK_KEY_OFFSETS: Readonly<Record<number, number>> = { 1: 2 / 3, 3: 1 / 3, 6: 3 / 4, 8: 1 / 2, 10: 1 / 4 };
const EPSILON = 1e-6;

describe('worked examples', () => {
  test('one octave from middle C on 144px white keys', () => {
    const layout = layoutKeys({ range: [60, 71], width: 1008, height: 200 });

    expect(layout.keys).toEqual([
      { note: 60, black: false, x: 0, y: 0, width: 144, height: 200 },
      { note: 61, black: true, x: 88, y: 0, width: 84, height: 130 },
      { note: 62, black: false, x: 144, y: 0, width: 144, height: 200 },
      { note: 63, black: true, x: 260, y: 0, width: 84, height: 130 },
      { note: 64, black: false, x: 288, y: 0, width: 144, height: 200 },
      { note: 65, black: false, x: 432, y: 0, width: 144, height: 200 },
      { note: 66, black: true, x: 513, y: 0, width: 84, height: 130 },
      { note: 67, black: false, x: 576, y: 0, width: 144, height: 200 },
      { note: 68, black: true, x: 678, y: 0, width: 84, height: 130 },
      { note: 69, black: false, x: 720, y: 0, width: 144, height: 200 },
      { note: 70, black: true, x: 843, y: 0, width: 84, height: 130 },
      { note: 71, black: false, x: 864, y: 0, width: 144, height: 200 },
    ]);
  });

  test('the default range is an 88-key piano', () => {
    const layout = layoutKeys({ width: 1248, height: 150, pixelRatio: 2 });

    expect(layout.range).toEqual([21, 108]);
    expect(layout.keys).toHaveLength(88);
    expect(layout.keys.filter((key) => key.black)).toHaveLength(36);
    expect(layout.keys.slice(0, 4)).toEqual([
      { note: 21, black: false, x: 0, y: 0, width: 24, height: 150 },
      { note: 22, black: true, x: 20.5, y: 0, width: 14, height: 97.5 },
      { note: 23, black: false, x: 24, y: 0, width: 24, height: 150 },
      { note: 24, black: false, x: 48, y: 0, width: 24, height: 150 },
    ]);
    expect(layout.keys.at(-1)).toEqual({ note: 108, black: false, x: 1224, y: 0, width: 24, height: 150 });
  });

  test('edges snap to device pixels at a fractional pixel ratio', () => {
    const layout = layoutKeys({ range: [60, 64], width: 500 / 1.5, height: 120, pixelRatio: 1.5 });

    expect(layout.keys.map((key) => [key.note, key.x * 1.5, key.width * 1.5])).toEqual([
      [60, 0, 167],
      [61, 102, 97],
      [62, 167, 166],
      [63, 301, 97],
      [64, 333, 167],
    ]);
  });

  test('a range that starts and ends on black keys spans from the first edge to the last', () => {
    const layout = layoutKeys({ range: [61, 63], width: 256, height: 100 });

    expect(layout.keys).toEqual([
      { note: 61, black: true, x: 0, y: 0, width: 84, height: 65 },
      { note: 62, black: false, x: 56, y: 0, width: 144, height: 100 },
      { note: 63, black: true, x: 172, y: 0, width: 84, height: 65 },
    ]);
  });

  test('white keys stay even when every edge falls exactly between two device pixels', () => {
    const layout = layoutKeys({ range: [10, 34], width: 1050, height: 40 });

    const whiteWidths = layout.keys.filter((key) => !key.black).map((key) => key.width);
    expect([...new Set(whiteWidths)]).toEqual([72]);
  });

  test('blackKeyLength sets how far black keys reach down', () => {
    const layout = layoutKeys({ range: [60, 61], width: 300, height: 200, blackKeyLength: 0.5 });

    expect(layout.keys[1]?.height).toBe(100);
  });

  test('a range that is not two numbers falls back to the default range', () => {
    expect(layoutKeys({ range: [Number.NaN, 60], width: 1248, height: 150 }).range).toEqual([21, 108]);
  });
});

describe('properties', () => {
  test('every range at every pixel ratio is an even keyboard on device pixels', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 12, max: 48, noNaN: true }),
        fc.integer({ min: 40, max: 600 }),
        fc.double({ min: 0.3, max: 0.9, noNaN: true }),
        (devicePixelsPerKey, deviceHeight, blackKeyLength) => {
          const violations: string[] = [];

          for (const pixelRatio of PIXEL_RATIOS) {
            for (let first = 0; first <= 127; first += 1) {
              for (let last = first; last <= 127; last += 1) {
                const deviceWidth = Math.round(devicePixelsPerKey * (last - first + 1));
                const layout = layoutKeys({
                  range: [first, last],
                  width: deviceWidth / pixelRatio,
                  height: deviceHeight / pixelRatio,
                  pixelRatio,
                  blackKeyLength,
                });
                const found = keyboardViolations(layout, { deviceWidth, deviceHeight, blackKeyLength });
                if (found.length > 0) violations.push(`[${first}, ${last}] @${pixelRatio}x: ${found.join('; ')}`);
              }
            }
          }

          expect(violations.slice(0, 5)).toEqual([]);
        }
      ),
      { numRuns: 8 }
    );
  });

  test('any numbers produce a layout with finite, non-negative rectangles', () => {
    fc.assert(
      fc.property(
        fc.record({
          range: fc.tuple(fc.double(), fc.double()),
          width: fc.double(),
          height: fc.double(),
          pixelRatio: fc.double(),
          blackKeyLength: fc.double(),
        }),
        (input) => {
          const layout = layoutKeys(input);
          const [first, last] = layout.range;

          expect(first).toBeGreaterThanOrEqual(0);
          expect(last).toBeLessThanOrEqual(127);
          expect(layout.keys.map((key) => key.note)).toEqual(notesBetween(first, last));
          for (const key of layout.keys) {
            for (const value of [key.x, key.y, key.width, key.height]) {
              expect(Number.isFinite(value) && value >= 0).toBe(true);
            }
          }
        }
      )
    );
  });
});

interface DeviceSize {
  deviceWidth: number;
  deviceHeight: number;
  blackKeyLength: number;
}

interface DeviceKey {
  note: number;
  black: boolean;
  left: number;
  right: number;
  bottom: number;
}

function keyboardViolations(layout: KlavierLayout, size: DeviceSize): string[] {
  const [first, last] = layout.range;
  const keys = layout.keys.map((key) => toDevicePixels(key, layout.pixelRatio));
  const whites = keys.filter((key) => !key.black);
  const blacks = keys.filter((key) => key.black);
  const violations: string[] = [];
  const check = (holds: boolean, message: string) => {
    if (!holds) violations.push(message);
  };

  check(keys.map((key) => key.note).join() === notesBetween(first, last).join(), 'notes are not the ascending range');
  check(
    keys.every((key) => key.black === BLACK_PITCH_CLASSES.includes(key.note % 12)),
    'wrong key colour'
  );
  check(
    keys.every((key) => isWhole(key.left) && isWhole(key.right)),
    'an edge is off the device pixel grid'
  );
  check(
    blacks.every((key) => isWhole(key.bottom)),
    'a black key ends off the device pixel grid'
  );
  check(Math.abs(Math.min(...keys.map((key) => key.left))) < EPSILON, 'the first edge is not at 0');
  check(
    Math.abs(Math.max(...keys.map((key) => key.right)) - size.deviceWidth) < EPSILON,
    'the last edge is not at the full width'
  );
  check(
    whites.every((key, index) => index === 0 || Math.abs(key.left - (whites[index - 1]?.right ?? 0)) < EPSILON),
    'white keys leave a gap or overlap'
  );
  check(spread(whites.map((key) => key.right - key.left)) <= 1 + EPSILON, 'white keys are uneven');
  check(spread(blacks.map((key) => key.right - key.left)) < EPSILON, 'black keys are uneven');
  check(
    whites.every((key) => Math.abs(key.bottom - size.deviceHeight) < EPSILON),
    'a white key is not full height'
  );
  check(
    blacks.every((key) => Math.abs(key.bottom - size.deviceHeight * size.blackKeyLength) <= 0.5 + EPSILON),
    'a black key has the wrong length'
  );

  for (const black of blacks) {
    const lower = whites.find((key) => key.note === black.note - 1);
    const upper = whites.find((key) => key.note === black.note + 1);
    const boundary = lower?.right ?? upper?.left;
    const blackWidth = black.right - black.left;
    const whiteWidth = lower ? lower.right - lower.left : upper ? upper.right - upper.left : undefined;

    if (boundary === undefined || whiteWidth === undefined) continue;

    check(black.left < boundary && boundary < black.right, `${black.note} does not straddle its white neighbours`);
    check(
      Math.abs(blackWidth - whiteWidth * BLACK_KEY_WIDTH_IN_WHITE_KEYS) <= 1.5,
      `${black.note} is not 7/12 of a white key`
    );
    check(
      Math.abs(boundary - black.left - blackWidth * (BLACK_KEY_OFFSETS[black.note % 12] ?? 0)) <= 1.5,
      `${black.note} is not at its offset`
    );
    check(!lower || black.left > lower.left, `${black.note} covers its lower neighbour`);
    check(!upper || black.right < upper.right, `${black.note} covers its upper neighbour`);
  }

  return violations;
}

function toDevicePixels(key: KeyRect, pixelRatio: number): DeviceKey {
  return {
    note: key.note,
    black: key.black,
    left: key.x * pixelRatio,
    right: (key.x + key.width) * pixelRatio,
    bottom: (key.y + key.height) * pixelRatio,
  };
}

function notesBetween(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (unused, index) => first + index);
}

function isWhole(value: number): boolean {
  return Math.abs(value - Math.round(value)) < EPSILON;
}

function spread(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}
