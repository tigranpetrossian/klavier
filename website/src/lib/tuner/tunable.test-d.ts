import { describe, expectTypeOf, test } from 'vitest';
import { tunable, type Color } from './tunable';

type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

describe('tunable', () => {
  test('widens literal number, string and boolean defaults', () => {
    expectTypeOf(tunable('toasts.limit', 3)).toEqualTypeOf<number>();
    expectTypeOf(tunable('toasts.label', 'Undo')).toEqualTypeOf<string>();
    expectTypeOf(tunable('toasts.enabled', true)).toEqualTypeOf<boolean>();
  });

  test('returns the type argument for unions, colors, null and empty arrays', () => {
    expectTypeOf(tunable<ToastPosition>('toasts.position', 'bottom-right')).toEqualTypeOf<ToastPosition>();
    expectTypeOf(tunable<Color>('card.accent', '#0d99ff')).toEqualTypeOf<Color>();
    expectTypeOf(tunable<string | null>('card.caption', null)).toEqualTypeOf<string | null>();
    expectTypeOf(tunable<readonly number[]>('chart.stops', [])).toEqualTypeOf<readonly number[]>();
  });

  test('infers structured defaults without a type argument', () => {
    expectTypeOf(tunable('card.padding', { x: 4, y: 8 })).toEqualTypeOf<{ x: number; y: number }>();
  });

  test('rejects a default that does not fit the type argument', () => {
    // @ts-expect-error: 'red' is not a hex, rgb(), hsl() or oklch() color
    tunable<Color>('card.accent', 'red');
    // @ts-expect-error: 'middle' is not a toast position
    tunable<ToastPosition>('toasts.position', 'middle');
  });

  test('rejects an id that is not a string', () => {
    // @ts-expect-error: ids are strings such as 'toasts.limit'
    tunable(1, 3);
  });
});

describe('Color', () => {
  test('is a hex, rgb(), hsl() or oklch() string', () => {
    expectTypeOf<Color>().toEqualTypeOf<`#${string}` | `rgb(${string})` | `hsl(${string})` | `oklch(${string})`>();
    expectTypeOf<'red'>().not.toExtend<Color>();
  });
});
