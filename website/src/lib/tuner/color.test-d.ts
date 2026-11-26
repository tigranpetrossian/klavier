import { describe, expectTypeOf, test } from 'vitest';
import {
  convertColor,
  formatColor,
  parseColor,
  type ColorChannels,
  type HslColor,
  type OklchColor,
  type RgbColor,
} from './color';
import type { ColorModel } from './react';
import type { Color } from './tunable';

declare const color: ColorChannels;
declare const model: ColorModel;

describe('color helpers', () => {
  test('parseColor reads any CSS color into channels or returns null', () => {
    expectTypeOf(parseColor).toEqualTypeOf<(input: string) => ColorChannels | null>();
  });

  test('channels are told apart by model', () => {
    expectTypeOf<ColorChannels>().toEqualTypeOf<RgbColor | HslColor | OklchColor>();
    expectTypeOf<RgbColor>().toEqualTypeOf<{ model: 'rgb'; r: number; g: number; b: number; alpha: number }>();
    expectTypeOf<HslColor>().toEqualTypeOf<{ model: 'hsl'; h: number; s: number; l: number; alpha: number }>();
    expectTypeOf<OklchColor>().toEqualTypeOf<{ model: 'oklch'; l: number; c: number; h: number; alpha: number }>();
  });

  test('convertColor returns the channels of the requested model', () => {
    expectTypeOf(convertColor(color, 'hex')).toEqualTypeOf<RgbColor>();
    expectTypeOf(convertColor(color, 'rgb')).toEqualTypeOf<RgbColor>();
    expectTypeOf(convertColor(color, 'hsl')).toEqualTypeOf<HslColor>();
    expectTypeOf(convertColor(color, 'oklch')).toEqualTypeOf<OklchColor>();
    expectTypeOf(convertColor(color, model)).toEqualTypeOf<ColorChannels>();
  });

  test('formatColor returns a Color in every model', () => {
    expectTypeOf(formatColor(color, 'hsl')).toEqualTypeOf<Color>();
    expectTypeOf(formatColor(color, model)).toEqualTypeOf<Color>();
  });

  test('rejects a model outside ColorModel', () => {
    // @ts-expect-error: cmyk is not a color model
    convertColor(color, 'cmyk');
    // @ts-expect-error: lab is not a color model
    formatColor(color, 'lab');
  });
});
