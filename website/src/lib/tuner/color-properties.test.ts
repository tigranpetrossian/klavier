import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  convertColor,
  formatColor,
  parseColor,
  type ColorChannels,
  type HslColor,
  type OklchColor,
  type RgbColor,
} from './color.ts';
import type { ColorModel } from './shared/constant-type.ts';

const MODELS: readonly ColorModel[] = ['hex', 'rgb', 'hsl', 'oklch'];
const COLOR_FUNCTIONS = [
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color(srgb',
  'color(display-p3',
];
const CHANNEL_TOKENS = ['none', '1e999', '-1e999', 'NaN', 'infinity', 'calc(infinity)', '50%', '120deg', ''];
const LIGHTNESS_KEPT_BY_GAMUT_MAPPING = 0.0201;

const cssLikeColor = fc
  .tuple(
    fc.constantFrom(...COLOR_FUNCTIONS),
    fc.array(fc.oneof(fc.double().map(String), fc.constantFrom(...CHANNEL_TOKENS)), { maxLength: 5 }),
    fc.constantFrom('', ' / 0.5', ' / 200%', ' / -1')
  )
  .map(([name, channels, alpha]) => `${name}(${channels.join(' ')}${alpha})`);

const alpha = between(0, 1);
const hue = fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true });

const srgbColor = fc
  .tuple(between(0, 255), between(0, 255), between(0, 255), alpha)
  .map(([r, g, b, a]): RgbColor => ({ model: 'rgb', r, g, b, alpha: a }));

const byteColor = fc
  .tuple(byte(), byte(), byte(), byte())
  .map(([r, g, b, alphaByte]): RgbColor => ({ model: 'rgb', r, g, b, alpha: alphaByte / 255 }));

const hslColor = fc
  .tuple(hue, between(0, 100), between(0, 100), alpha)
  .map(([h, s, l, a]): HslColor => ({ model: 'hsl', h, s, l, alpha: a }));

const oklchColor = fc
  .tuple(between(0, 1), between(0, 0.5), hue, alpha)
  .map(([l, c, h, a]): OklchColor => ({ model: 'oklch', l, c, h, alpha: a }));

const anyAngle = between(-720, 720);

const builtColor: fc.Arbitrary<ColorChannels> = fc.oneof(
  fc
    .tuple(between(-100, 400), between(-100, 400), between(-100, 400), alpha)
    .map(([r, g, b, a]): RgbColor => ({ model: 'rgb', r, g, b, alpha: a })),
  fc
    .tuple(anyAngle, between(-50, 150), between(-50, 150), alpha)
    .map(([h, s, l, a]): HslColor => ({ model: 'hsl', h, s, l, alpha: a })),
  fc
    .tuple(between(0, 1), between(0, 0.5), anyAngle, alpha)
    .map(([l, c, h, a]): OklchColor => ({ model: 'oklch', l, c, h, alpha: a }))
);

describe('parseColor properties', () => {
  test('any text either parses to finite channels or returns null', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), cssLikeColor), (input) => {
        const color = parseColor(input);
        if (color === null) return;
        expect(
          Object.values(color)
            .filter((value) => typeof value === 'number')
            .every(Number.isFinite)
        ).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

describe('formatColor round trips', () => {
  test('hex and rgb text parse back to within half a step of each channel', () => {
    fc.assert(
      fc.property(srgbColor, fc.constantFrom<ColorModel>('hex', 'rgb'), (color, model) => {
        const parsed = parseFormatted(color, model);
        expect(parsed.model).toBe('rgb');
        const back = convertColor(parsed, 'rgb');
        expect(Math.abs(back.r - color.r)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(back.g - color.g)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(back.b - color.b)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(back.alpha - color.alpha)).toBeLessThanOrEqual(0.5 / 255);
      })
    );
  });

  test('hsl text parses back to within its two decimals', () => {
    fc.assert(
      fc.property(hslColor, (color) => {
        const back = parseFormatted(color, 'hsl');
        expect(back.model).toBe('hsl');
        const channels = convertColor(back, 'hsl');
        expect(hueDistance(channels.h, color.h)).toBeLessThanOrEqual(0.005);
        expect(Math.abs(channels.s - color.s)).toBeLessThanOrEqual(0.005);
        expect(Math.abs(channels.l - color.l)).toBeLessThanOrEqual(0.005);
        expect(Math.abs(channels.alpha - color.alpha)).toBeLessThanOrEqual(0.0005);
      })
    );
  });

  test('oklch text parses back to within its decimals, even outside sRGB', () => {
    fc.assert(
      fc.property(oklchColor, (color) => {
        const back = parseFormatted(color, 'oklch');
        expect(back.model).toBe('oklch');
        const channels = convertColor(back, 'oklch');
        expect(Math.abs(channels.l - color.l)).toBeLessThanOrEqual(0.00005);
        expect(Math.abs(channels.c - color.c)).toBeLessThanOrEqual(0.000005);
        expect(hueDistance(channels.h, color.h)).toBeLessThanOrEqual(0.005);
        expect(Math.abs(channels.alpha - color.alpha)).toBeLessThanOrEqual(0.0005);
      })
    );
  });

  test('a hex color formatted in any model formats back to the same hex', () => {
    fc.assert(
      fc.property(byteColor, fc.constantFrom(...MODELS), (color, model) => {
        const hex = formatColor(color, 'hex');
        expect(formatColor(parseFormatted(color, model), 'hex')).toBe(hex);
      })
    );
  });

  test('an oklch color outside sRGB lands in sRGB in hex, rgb and hsl', () => {
    fc.assert(
      fc.property(oklchColor, fc.constantFrom<ColorModel>('hex', 'rgb', 'hsl'), (color, model) => {
        expect(isWithinChannelRanges(parseFormatted(color, model))).toBe(true);
      })
    );
  });
});

describe('convertColor properties', () => {
  test('channels read in any model stay within its ranges, limited to sRGB outside oklch', () => {
    fc.assert(
      fc.property(builtColor, fc.constantFrom(...MODELS), (color, model) => {
        expect(isWithinChannelRanges(convertColor(color, model))).toBe(true);
      })
    );
  });

  test('a color built from channels read in a model reads back the same channels', () => {
    fc.assert(
      fc.property(builtColor, fc.constantFrom(...MODELS), (color, model) => {
        const channels = convertColor(color, model);
        expect(convertColor({ ...channels }, model)).toEqual(channels);
      })
    );
  });

  test('an sRGB color survives a trip through oklch', () => {
    fc.assert(
      fc.property(srgbColor, (color) => {
        const back = convertColor(convertColor(color, 'oklch'), 'rgb');
        expect(back.r).toBeCloseTo(color.r, 4);
        expect(back.g).toBeCloseTo(color.g, 4);
        expect(back.b).toBeCloseTo(color.b, 4);
        expect(back.alpha).toBe(color.alpha);
      })
    );
  });

  test('mapping an oklch color into sRGB keeps its lightness within the CSS gamut-mapping JND', () => {
    fc.assert(
      fc.property(oklchColor, fc.constantFrom<ColorModel>('rgb', 'hsl'), (color, model) => {
        const mapped = convertColor(convertColor(color, model), 'oklch');
        expect(Math.abs(mapped.l - color.l)).toBeLessThanOrEqual(LIGHTNESS_KEPT_BY_GAMUT_MAPPING);
      })
    );
  });
});

function parseFormatted(color: ColorChannels, model: ColorModel): ColorChannels {
  const text = formatColor(color, model);
  const parsed = parseColor(text);
  if (parsed === null) throw new Error(`formatted text does not parse: ${text}`);
  return parsed;
}

function isWithinChannelRanges(color: ColorChannels): boolean {
  switch (color.model) {
    case 'rgb':
      return [color.r, color.g, color.b].every((channel) => channel >= 0 && channel <= 255);
    case 'hsl':
      return isHue(color.h) && [color.s, color.l].every((channel) => channel >= 0 && channel <= 100);
    case 'oklch':
      return isHue(color.h) && color.c >= 0;
  }
}

function isHue(angle: number): boolean {
  return angle >= 0 && angle < 360;
}

function hueDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

function between(min: number, max: number): fc.Arbitrary<number> {
  return fc.double({ min, max, noNaN: true });
}

function byte(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 255 });
}
