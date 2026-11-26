import { expect, test } from 'vitest';
import { CSS_COLOR, cssNumber, FEATURE_SETTINGS, FONT_FAMILY, VARIATION_SETTINGS } from './css-codecs.ts';

const PX = cssNumber('px');

test('a number codec reads numbers in its unit and writes them back with the unit', () => {
  expect([PX.parse('18px'), PX.parse('1em'), PX.parse('var(--gap)'), PX.format(0.1 + 0.2, '4px'), PX.empty]).toEqual([
    18,
    null,
    null,
    '0.3px',
    0,
  ]);
});

test('the color codec reads any CSS color and no references', () => {
  expect(
    ['#0d99ff', 'rgb(13 153 255)', 'rgba(0, 0, 0, 0.5)', 'transparent', 'oklab(0.5 0.1 0.1)', 'var(--brand)'].map(
      CSS_COLOR.parse
    )
  ).toEqual(['#0d99ff', 'rgb(13 153 255)', 'rgba(0, 0, 0, 0.5)', 'transparent', 'oklab(0.5 0.1 0.1)', null]);
});

test('the color codec keeps an edit in its model over a literal, and writes hex over a reference', () => {
  expect([
    CSS_COLOR.format('rgb(255, 0, 0)', '#00ff00'),
    CSS_COLOR.format('rgb(255, 0, 0)', 'var(--brand)'),
    CSS_COLOR.format('rgb(255, 0, 0)', 'color-mix(in srgb, red, blue)'),
  ]).toEqual(['rgb(255, 0, 0)', '#ff0000', '#ff0000']);
});

test('the font family codec reads the first family and replaces it while keeping fallbacks', () => {
  expect([
    FONT_FAMILY.parse("'Inter', system-ui, sans-serif"),
    FONT_FAMILY.format('Roobert VF-TRIAL', "'Inter', system-ui, sans-serif"),
  ]).toEqual(['Inter', "'Roobert VF-TRIAL', system-ui, sans-serif"]);
});

test('the settings codecs read and write whole font settings', () => {
  expect([
    VARIATION_SETTINGS.parse("'wght' 500, 'slnt' -5"),
    VARIATION_SETTINGS.format({ wght: 600 }, "'wght' 500"),
    FEATURE_SETTINGS.parse("'ss01' 1"),
    FEATURE_SETTINGS.format({}, "'ss01' 1"),
  ]).toEqual([{ wght: 500, slnt: -5 }, "'wght' 600", { ss01: 1 }, 'normal']);
});
