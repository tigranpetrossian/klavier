import { expect, test } from 'vitest';
import { formatCssNumber, parseCssNumber } from './css-numbers.ts';

test.each([
  ['18px', 'px', 18],
  [' 0.008em ', 'em', 0.008],
  ['480', '', 480],
  ['-1.5E2PX', 'px', -150],
  ['0', 'px', 0],
  ['18px', 'em', null],
  ['18', 'px', null],
  ['var(--size)', 'px', null],
  ['calc(1px + 2px)', 'px', null],
])('parses %s with unit %s as %s', (text, unit, value) => {
  expect(parseCssNumber(text, unit)).toBe(value);
});

test('formats a number with its unit and without float noise', () => {
  expect([formatCssNumber(0.1 + 0.2, 'em'), formatCssNumber(480), formatCssNumber(-0.0000001, 'px')]).toEqual([
    '0.3em',
    '480',
    '0px',
  ]);
});
