import { formatColor, parseColor } from '../color';
import type { PropertyCodec } from '../react';
import { formatCssNumber, parseCssNumber } from './css-numbers';
import {
  fontFamilyOf,
  formatFeatureSettings,
  formatVariationSettings,
  parseFeatureSettings,
  parseVariationSettings,
  withFontFamily,
  type FontSettings,
} from './font-settings';

const NO_SETTINGS: FontSettings = {};

export const CSS_COLOR: PropertyCodec<string> = {
  empty: '',
  parse: (css) => (isColor(css) ? css : null),
  format: (color, current) => (isColor(current) ? color : toHex(color)),
};

export const FONT_FAMILY: PropertyCodec<string> = {
  empty: '',
  parse: fontFamilyOf,
  format: (family, current) => withFontFamily(current, family),
};

export const VARIATION_SETTINGS: PropertyCodec<FontSettings> = {
  empty: NO_SETTINGS,
  parse: parseVariationSettings,
  format: formatVariationSettings,
};

export const FEATURE_SETTINGS: PropertyCodec<FontSettings> = {
  empty: NO_SETTINGS,
  parse: parseFeatureSettings,
  format: formatFeatureSettings,
};

export function cssNumber(unit = ''): PropertyCodec<number> {
  return {
    empty: 0,
    parse: (css) => parseCssNumber(css, unit),
    format: (value) => formatCssNumber(value, unit),
  };
}

function isColor(css: string): boolean {
  return parseColor(css) !== null;
}

function toHex(color: string): string {
  const parsed = parseColor(color);
  return parsed === null ? color : formatColor(parsed, 'hex');
}
