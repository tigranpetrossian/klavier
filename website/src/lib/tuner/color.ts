import {
  converter,
  differenceEuclidean,
  parse,
  toGamut,
  type Color as CuloriColor,
  type Hsl,
  type Oklch,
  type Rgb,
} from 'culori';
import type { ColorModel } from './shared/constant-type';
import type { Color } from './tunable';

const GAMUT_MAPPING_JND = 0.02;
const ALPHA_DECIMALS = 3;
const HSL_DECIMALS = 2;
const OKLCH_DECIMALS = { l: 4, c: 5, h: 2 };

const CONVERTERS: { [M in ColorModel]: (color: ColorChannels) => ColorIn<M> } = {
  hex: toRgbColor,
  rgb: toRgbColor,
  hsl: toHslColor,
  oklch: toOklchColor,
};

const FORMATTERS: { [M in ColorModel]: (color: ColorIn<M>) => Color } = {
  hex: formatHex,
  rgb: formatRgb,
  hsl: formatHsl,
  oklch: formatOklch,
};

const toOklch = converter('oklch');
const toRgb = converter('rgb');
const reduceChromaIntoSrgb = toGamut('rgb', 'oklch');
const deltaEok = differenceEuclidean('oklab');

export type { Color, ColorModel };

export type RgbColor = { model: 'rgb'; r: number; g: number; b: number; alpha: number };
export type HslColor = { model: 'hsl'; h: number; s: number; l: number; alpha: number };
export type OklchColor = { model: 'oklch'; l: number; c: number; h: number; alpha: number };
export type ColorChannels = RgbColor | HslColor | OklchColor;
export type ColorIn<M extends ColorModel> = { hex: RgbColor; rgb: RgbColor; hsl: HslColor; oklch: OklchColor }[M];

export function parseColor(input: string): ColorChannels | null {
  const parsed = parseCss(input);
  if (parsed === undefined) return null;
  const color = fromCulori(parsed);
  return hasFiniteChannels(color) ? color : null;
}

export function convertColor<M extends ColorModel>(color: ColorChannels, model: M): ColorIn<M> {
  return CONVERTERS[model](color);
}

export function formatColor<M extends ColorModel>(color: ColorChannels, model: M): Color {
  return FORMATTERS[model](convertColor(color, model));
}

function toRgbColor(color: ColorChannels): RgbColor {
  if (color.model === 'rgb' && isInRgbRange(color)) return color;
  return fromCuloriRgb(mapIntoSrgb(color));
}

function toHslColor(color: ColorChannels): HslColor {
  if (color.model === 'hsl' && isInHslRange(color)) return { ...color, h: normalizeHue(color.h) };
  return srgbToHsl(mapIntoSrgb(color));
}

function toOklchColor(color: ColorChannels): OklchColor {
  if (color.model === 'oklch') return { ...color, h: normalizeHue(color.h) };
  return fromCuloriOklch(toOklch(toCulori(color)));
}

function isInRgbRange({ r, g, b }: RgbColor): boolean {
  return [r, g, b].every((channel) => channel >= 0 && channel <= 255);
}

function isInHslRange({ s, l }: HslColor): boolean {
  return [s, l].every((channel) => channel >= 0 && channel <= 100);
}

// CSS Color 4 gamut mapping (https://drafts.csswg.org/css-color-4/#binsearch) returns the clipped color
// when it is within JND of the origin. culori's toGamut skips that step and reduces chroma instead.
function mapIntoSrgb(color: ColorChannels): Rgb {
  const origin = toCulori(color);
  const clipped = clipToSrgb(toRgb(origin));
  return isClipWithinJnd(origin, clipped) ? clipped : clipToSrgb(reduceChromaIntoSrgb(origin));
}

function isClipWithinJnd(origin: CuloriColor, clipped: Rgb): boolean {
  const { l } = toOklch(origin);
  return l > 0 && l < 1 && deltaEok(origin, clipped) < GAMUT_MAPPING_JND;
}

function clipToSrgb({ r, g, b, alpha }: Rgb): Rgb {
  return { mode: 'rgb', r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1), alpha };
}

// culori's rgb-to-hsl divides by 1 - |max + min - 1|, which rounds to zero just above black.
function srgbToHsl({ r, g, b, alpha = 1 }: Rgb): HslColor {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  if (chroma === 0) return { model: 'hsl', h: 0, s: 0, l: lightness * 100, alpha };
  const saturation = chroma / (lightness < 0.5 ? max + min : 2 - max - min);
  return { model: 'hsl', h: srgbHue(r, g, b, max, chroma), s: saturation * 100, l: lightness * 100, alpha };
}

function srgbHue(r: number, g: number, b: number, max: number, chroma: number): number {
  if (max === r) return (((g - b) / chroma + 6) % 6) * 60;
  if (max === g) return ((b - r) / chroma + 2) * 60;
  return ((r - g) / chroma + 4) * 60;
}

function formatHex({ r, g, b, alpha }: RgbColor): Color {
  const alphaByte = Math.round(clamp(alpha, 0, 1) * 255);
  const alphaDigits = alphaByte === 255 ? '' : hexByte(alphaByte);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${alphaDigits}`;
}

function formatRgb({ r, g, b, alpha }: RgbColor): Color {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)}${alphaSuffix(alpha)})`;
}

function formatHsl({ h, s, l, alpha }: HslColor): Color {
  return `hsl(${decimal(h, HSL_DECIMALS)} ${decimal(s, HSL_DECIMALS)}% ${decimal(l, HSL_DECIMALS)}%${alphaSuffix(alpha)})`;
}

function formatOklch({ l, c, h, alpha }: OklchColor): Color {
  return `oklch(${decimal(l, OKLCH_DECIMALS.l)} ${decimal(c, OKLCH_DECIMALS.c)} ${decimal(h, OKLCH_DECIMALS.h)}${alphaSuffix(alpha)})`;
}

function alphaSuffix(alpha: number): string {
  const rounded = decimal(clamp(alpha, 0, 1), ALPHA_DECIMALS);
  return rounded === '1' ? '' : ` / ${rounded}`;
}

function decimal(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

function hexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

function normalizeHue(hue: number): number {
  const turned = hue % 360;
  return turned < 0 ? (turned + 360) % 360 : turned;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseCss(input: string): CuloriColor | undefined {
  try {
    return parse(input);
  } catch {
    // culori 4.0.2's tokenizer throws a TypeError on some malformed input, such as '/0A'.
    return undefined;
  }
}

function hasFiniteChannels(color: ColorChannels): boolean {
  return Object.values(color).every((value) => typeof value !== 'number' || Number.isFinite(value));
}

function toCulori(color: ColorChannels): CuloriColor {
  switch (color.model) {
    case 'rgb':
      return { mode: 'rgb', r: color.r / 255, g: color.g / 255, b: color.b / 255, alpha: color.alpha };
    case 'hsl':
      return { mode: 'hsl', h: color.h, s: color.s / 100, l: color.l / 100, alpha: color.alpha };
    case 'oklch':
      return { mode: 'oklch', l: color.l, c: color.c, h: color.h, alpha: color.alpha };
  }
}

function fromCulori(color: CuloriColor): ColorChannels {
  if (color.mode === 'rgb') return fromCuloriRgb(color);
  if (color.mode === 'hsl') return fromCuloriHsl(color);
  return fromCuloriOklch(toOklch(color));
}

function fromCuloriRgb({ r, g, b, alpha = 1 }: Rgb): RgbColor {
  return { model: 'rgb', r: r * 255, g: g * 255, b: b * 255, alpha };
}

function fromCuloriHsl({ h = 0, s, l, alpha = 1 }: Hsl): HslColor {
  return { model: 'hsl', h: normalizeHue(h), s: s * 100, l: l * 100, alpha };
}

function fromCuloriOklch({ l, c, h = 0, alpha = 1 }: Oklch): OklchColor {
  return { model: 'oklch', l, c, h: normalizeHue(h), alpha };
}
