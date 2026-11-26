import { describe, expect, test } from 'vitest';
import { convertColor, formatColor, parseColor, type RgbColor } from './color.ts';

const HAIR_ABOVE_BLACK: RgbColor = { model: 'rgb', r: 0, g: 0, b: 1e-17, alpha: 1 };

describe('parseColor', () => {
  test('reads a six-digit hex color as rgb channels', () => {
    expect(parseColor('#0d99ff')).toEqual({
      model: 'rgb',
      r: expect.closeTo(13, 9),
      g: expect.closeTo(153, 9),
      b: expect.closeTo(255, 9),
      alpha: 1,
    });
  });

  test('reads a four-digit hex color with its alpha', () => {
    expect(parseColor('#0bf8')).toEqual({
      model: 'rgb',
      r: 0,
      g: expect.closeTo(187, 9),
      b: expect.closeTo(255, 9),
      alpha: expect.closeTo(136 / 255, 9),
    });
  });

  test('reads a named color as rgb channels', () => {
    expect(parseColor('rebeccapurple')).toEqual({
      model: 'rgb',
      r: expect.closeTo(102, 9),
      g: expect.closeTo(51, 9),
      b: expect.closeTo(153, 9),
      alpha: 1,
    });
  });

  test('keeps an hsl color in hsl channels', () => {
    expect(parseColor('hsl(210 100% 50%)')).toEqual({ model: 'hsl', h: 210, s: 100, l: 50, alpha: 1 });
  });

  test('keeps the hue of a gray hsl color', () => {
    expect(parseColor('hsl(210 0% 50%)')).toEqual({ model: 'hsl', h: 210, s: 0, l: 50, alpha: 1 });
  });

  test('reads a missing oklch hue as zero', () => {
    expect(parseColor('oklch(0.7 0 none / 50%)')).toEqual({ model: 'oklch', l: 0.7, c: 0, h: 0, alpha: 0.5 });
  });

  test('reads a color from another space as oklch channels', () => {
    expect(parseColor('lab(50% 0 0)')).toEqual({
      model: 'oklch',
      l: expect.closeTo(0.569, 3),
      c: expect.closeTo(0, 3),
      h: expect.any(Number),
      alpha: 1,
    });
  });

  test.each(['', 'not a color', '#12', '#12345', 'rgb(', 'oklch(0.5 0.1)', 'var(--accent)', '/0A', 'lab(0 0 -1e200)'])(
    'returns null for %j',
    (input) => {
      expect(parseColor(input)).toBeNull();
    }
  );
});

describe('formatColor', () => {
  test('formats an opaque color as six-digit hex', () => {
    expect(formatColor({ model: 'rgb', r: 13, g: 153, b: 255, alpha: 1 }, 'hex')).toBe('#0d99ff');
  });

  test('formats a translucent color as eight-digit hex', () => {
    expect(formatColor({ model: 'rgb', r: 13, g: 153, b: 255, alpha: 0.5 }, 'hex')).toBe('#0d99ff80');
  });

  test('formats rgb with whole channels and an alpha only when translucent', () => {
    expect(formatColor({ model: 'rgb', r: 13.2, g: 152.8, b: 255, alpha: 1 }, 'rgb')).toBe('rgb(13 153 255)');
    expect(formatColor({ model: 'rgb', r: 13, g: 153, b: 255, alpha: 0.5 }, 'rgb')).toBe('rgb(13 153 255 / 0.5)');
  });

  test('formats an rgb color in hsl with two decimals', () => {
    expect(formatColor({ model: 'rgb', r: 13, g: 153, b: 255, alpha: 1 }, 'hsl')).toBe('hsl(205.29 100% 52.55%)');
  });

  test('formats sRGB red in oklch as the CSS Color 4 reference value', () => {
    expect(formatColor({ model: 'rgb', r: 255, g: 0, b: 0, alpha: 1 }, 'oklch')).toBe('oklch(0.628 0.25768 29.23)');
  });

  test('keeps the hue of a gray hsl color', () => {
    expect(formatColor({ model: 'hsl', h: 210, s: 0, l: 50, alpha: 1 }, 'hsl')).toBe('hsl(210 0% 50%)');
  });

  test('keeps an oklch color outside sRGB when formatting in oklch', () => {
    expect(formatColor({ model: 'oklch', l: 0.7, c: 0.4, h: 150, alpha: 1 }, 'oklch')).toBe('oklch(0.7 0.4 150)');
  });

  test('maps oklch lightness at or past the ends to white and black, as CSS Color 4 gamut mapping does', () => {
    expect(formatColor({ model: 'oklch', l: 1, c: 0.4, h: 30, alpha: 1 }, 'hex')).toBe('#ffffff');
    expect(formatColor({ model: 'oklch', l: 0, c: 0.4, h: 30, alpha: 1 }, 'hex')).toBe('#000000');
  });

  test('clips a color just outside sRGB instead of desaturating it, as CSS Color 4 gamut mapping does', () => {
    expect(formatColor({ model: 'oklch', l: 0.8673, c: 0.28933, h: 142.989, alpha: 1 }, 'hex')).toBe('#07ff21');
  });

  test('formats a neutral lab color as its sRGB gray', () => {
    const lab = parseColor('lab(50% 0 0)');
    expect(lab && formatColor(lab, 'hex')).toBe('#777777');
  });

  test('formats alpha with three decimals', () => {
    const alphaOf0x80 = 128 / 255;
    expect(formatColor({ model: 'rgb', r: 13, g: 153, b: 255, alpha: alphaOf0x80 }, 'rgb')).toBe(
      'rgb(13 153 255 / 0.502)'
    );
    expect(formatColor({ model: 'oklch', l: 0.5, c: 0.1, h: 250, alpha: 0.9999 }, 'oklch')).toBe('oklch(0.5 0.1 250)');
  });

  test('clamps alpha built outside 0 to 1', () => {
    expect(formatColor({ model: 'rgb', r: 0, g: 0, b: 0, alpha: 1.5 }, 'hex')).toBe('#000000');
    expect(formatColor({ model: 'oklch', l: 0.5, c: 0.1, h: 250, alpha: -0.5 }, 'oklch')).toBe(
      'oklch(0.5 0.1 250 / 0)'
    );
  });
});

describe('convertColor', () => {
  test('reads an hsl color as rgb channels', () => {
    expect(convertColor({ model: 'hsl', h: 60, s: 50, l: 50, alpha: 0.5 }, 'rgb')).toEqual({
      model: 'rgb',
      r: expect.closeTo(191.25, 6),
      g: expect.closeTo(191.25, 6),
      b: expect.closeTo(63.75, 6),
      alpha: 0.5,
    });
  });

  test('maps an out-of-gamut oklch color into the sRGB channel range', () => {
    const { r, g, b } = convertColor({ model: 'oklch', l: 0.7, c: 0.4, h: 150, alpha: 1 }, 'rgb');
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });

  test('maps rgb channels built beyond 255 into range', () => {
    const { r, g, b } = convertColor({ model: 'rgb', r: 300, g: 20, b: -10, alpha: 1 }, 'hex');
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });

  test('reads a color a hair above black as black in hsl', () => {
    const { s, l } = convertColor(HAIR_ABOVE_BLACK, 'hsl');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(l).toBeCloseTo(0, 9);
  });

  test('reads hues outside 0 to 360 degrees as the same angle within that range', () => {
    expect(convertColor({ model: 'hsl', h: -30, s: 100, l: 50, alpha: 1 }, 'hsl').h).toBe(330);
    expect(convertColor({ model: 'oklch', l: 0.5, c: 0.1, h: 400, alpha: 1 }, 'oklch').h).toBe(40);
  });

  test('maps hsl channels built beyond 100% into range', () => {
    const { s, l } = convertColor({ model: 'hsl', h: 0, s: 150, l: 120, alpha: 1 }, 'hsl');
    for (const channel of [s, l]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(100);
    }
  });
});
