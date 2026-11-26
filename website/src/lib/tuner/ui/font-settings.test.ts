import { describe, expect, test } from 'vitest';
import {
  featureEnabled,
  fontFamilyOf,
  formatFeatureSettings,
  formatVariationSettings,
  parseFeatureSettings,
  parseVariationSettings,
  withFeature,
  withFontFamily,
} from './font-settings.ts';

describe('font-variation-settings', () => {
  test.each([
    ["'MONO' 0, 'slnt' 0", { MONO: 0, slnt: 0 }],
    ['"wght" 480.5,"wdth" -1e1', { wght: 480.5, wdth: -10 }],
    ['normal', {}],
    ["'wght' 400, 'wght' 500", { wght: 500 }],
  ])('parses %s', (css, settings) => {
    expect(parseVariationSettings(css)).toEqual(settings);
  });

  test.each(["'wght'", "'wgh' 400", 'var(--axes)', "'wght' 400,", ''])('rejects %s', (css) => {
    expect(parseVariationSettings(css)).toBeNull();
  });

  test('formats settings with quoted tags, and no settings as normal', () => {
    expect([formatVariationSettings({ MONO: 0, slnt: -5.5 }), formatVariationSettings({})]).toEqual([
      "'MONO' 0, 'slnt' -5.5",
      'normal',
    ]);
  });
});

describe('font-feature-settings', () => {
  test.each([
    ["'ss01' 1", { ss01: 1 }],
    ["'ss01', 'liga' off, 'calt' on, 'salt' 2", { ss01: 1, liga: 0, calt: 1, salt: 2 }],
    ['normal', {}],
  ])('parses %s', (css, settings) => {
    expect(parseFeatureSettings(css)).toEqual(settings);
  });

  test.each(["'ss01' -1", "'ss01' 1.5", 'ss01'])('rejects %s', (css) => {
    expect(parseFeatureSettings(css)).toBeNull();
  });

  test('a feature that is on by default is on unless turned off, and others are off unless turned on', () => {
    expect([
      featureEnabled({}, 'liga'),
      featureEnabled({ liga: 0 }, 'liga'),
      featureEnabled({}, 'ss01'),
      featureEnabled({ ss01: 1 }, 'ss01'),
    ]).toEqual([true, false, false, true]);
  });

  test('turning a feature to its default drops it, and away from its default writes 0 or 1', () => {
    expect([
      formatFeatureSettings(withFeature({ ss01: 1 }, 'liga', false)),
      formatFeatureSettings(withFeature({ liga: 0, ss01: 1 }, 'liga', true)),
      formatFeatureSettings(withFeature({ ss01: 1 }, 'ss01', false)),
      formatFeatureSettings(withFeature({}, 'tnum', true)),
    ]).toEqual(["'ss01' 1, 'liga' 0", "'ss01' 1", 'normal', "'tnum' 1"]);
  });
});

describe('font-family', () => {
  test.each([
    ["'Roobert Collection VF TRIAL'", 'Roobert Collection VF TRIAL'],
    ['"Inter", system-ui, sans-serif', 'Inter'],
    ['Helvetica  Neue, Arial', 'Helvetica Neue'],
    ["'It\\'s', serif", "It's"],
    ['', null],
    ['var(--font)', null],
  ])('the first family of %s is %s', (css, family) => {
    expect(fontFamilyOf(css)).toBe(family);
  });

  test('replacing the family quotes it and keeps the fallbacks as written', () => {
    expect([
      withFontFamily("'Inter', system-ui,sans-serif", 'Roobert VF-TRIAL'),
      withFontFamily('', 'Roobert'),
      withFontFamily('Inter', 'sans-serif'),
    ]).toEqual(["'Roobert VF-TRIAL', system-ui, sans-serif", "'Roobert'", 'sans-serif']);
  });
});
