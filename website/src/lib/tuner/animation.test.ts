import { describe, expect, test } from 'vitest';
import {
  animationDuration,
  animationEasing,
  animationProgress,
  animationTransition,
  convertAnimation,
  isAnimation,
  sampleAnimation,
  summarizeAnimation,
  type Animation,
} from './animation.ts';

const SPRING: Animation = { type: 'spring', stiffness: 112, damping: 24, mass: 1, delay: 0 };
const TIME: Animation = { type: 'time', duration: 200, bounce: 0.15, delay: 0 };
const EASING: Animation = { type: 'easing', duration: 240, bezier: [0.17, 0.67, 0.83, 0.67], delay: 0 };
const RINGING: Animation = { type: 'time', duration: 100, bounce: 1, delay: 0 };
const RINGING_FIRST_PEAK = 1.8545;

describe('summarizeAnimation', () => {
  test.each([
    [SPRING, 'Spring · 112 | 24 | 1'],
    [TIME, 'Duration · 200ms | 0.15'],
    [EASING, 'Ease · cubic-bezier(.17,.67,.83,.67)'],
    [{ ...TIME, delay: 80 }, 'Duration · 200ms | 0.15 · 80ms delay'],
  ])('summarizes %o as %s', (animation, summary) => {
    expect(summarizeAnimation(animation)).toBe(summary);
  });
});

describe('isAnimation', () => {
  test.each([SPRING, TIME, EASING])('accepts %o', (animation) => {
    expect(isAnimation(animation)).toBe(true);
  });

  test.each([
    null,
    { type: 'spring', stiffness: 112, damping: 24, mass: 1 },
    { type: 'time', duration: 200, bounce: 0.15, delay: 0, extra: 1 },
    { type: 'easing', duration: 200, bezier: [0, 0, 1], delay: 0 },
    { type: 'tween', duration: 200, delay: 0 },
    { ...SPRING, mass: Number.NaN },
  ])('rejects %o', (value) => {
    expect(isAnimation(value)).toBe(false);
  });
});

describe('settling', () => {
  test.each([
    ['a critically damped spring', { stiffness: 100, damping: 20, mass: 1 }, 743.01],
    ['an overdamped spring', { stiffness: 112, damping: 24, mass: 1 }, 905.45],
    ['a slow spring that needs more than ten seconds', { stiffness: 8, damping: 39, mass: 6.9 }, 25042.72],
    ['the slowest spring the editor allows', { stiffness: 1, damping: 100, mass: 10 }, 529401.5],
    ['a ringing spring', { stiffness: 3947.84, damping: 6.28, mass: 1 }, 1659.48],
    ['a heavy spring that rings for minutes', { stiffness: 1000, damping: 1, mass: 10 }, 105882.64],
  ])('%s lasts until it stays within a 200th of the end', (_, spring, settleTime) => {
    const duration = animationDuration({ type: 'spring', ...spring, delay: 0 });

    expect(Math.abs(duration - settleTime)).toBeLessThan(0.5);
  });

  test('a time animation settles like the spring it converts to', () => {
    expect(animationDuration(TIME)).toBeCloseTo(258.42, 0);
  });

  test.each([
    ['no damping', { stiffness: 100, damping: 0, mass: 1 }],
    ['negative damping', { stiffness: 100, damping: -4, mass: 1 }],
    ['no stiffness', { stiffness: 0, damping: 10, mass: 1 }],
    ['no mass', { stiffness: 100, damping: 10, mass: 0 }],
  ])('a spring with %s never settles, so it does not animate', (_, spring) => {
    const stuck: Animation = { type: 'spring', ...spring, delay: 0 };

    expect(animationDuration(stuck)).toBe(0);
    expect(sampleAnimation(stuck, 4)).toEqual([1, 1, 1, 1]);
    expect(animationTransition(stuck, 'opacity')).toBe('opacity 0ms linear(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1) 0ms');
  });
});

describe('animationProgress', () => {
  test.each([
    [-10, 0],
    [0, 0],
    [250, 0.6872],
    [500, 0.9346],
    [1000, 1],
  ])('a spring that settles in 905ms is at %dms %d of the way', (ms, progress) => {
    expect(animationProgress(SPRING, ms)).toBeCloseTo(progress, 4);
  });

  test('a slow spring is a third of the way after two seconds', () => {
    const slow: Animation = { type: 'spring', stiffness: 8, damping: 39, mass: 6.9, delay: 0 };

    expect(animationProgress(slow, 2000)).toBeCloseTo(0.3205, 4);
  });

  test('a time animation is nearly there after its duration, as in Motion', () => {
    expect(animationProgress({ ...TIME, bounce: 0 }, 200)).toBeCloseTo(0.9668, 3);
  });

  test('an easing follows its cubic-bezier until its duration, then stays at the end', () => {
    const linear: Animation = { type: 'easing', duration: 300, bezier: [0, 0, 1, 1], delay: 0 };

    expect([150, 300, 400].map((ms) => animationProgress(linear, ms))).toEqual([expect.closeTo(0.5, 4), 1, 1]);
  });

  test('a spring that never settles is at the end from the start', () => {
    expect(animationProgress({ type: 'spring', stiffness: 100, damping: 0, mass: 1, delay: 0 }, 0)).toBe(1);
  });
});

describe('sampling and CSS', () => {
  test('a spring that rings faster than the requested samples is sampled finely enough to keep its peaks', () => {
    expect(Math.max(...sampleAnimation(RINGING, 12))).toBeCloseTo(RINGING_FIRST_PEAK, 1);
  });

  test('a smooth animation has exactly the requested number of samples', () => {
    expect(sampleAnimation(SPRING, 40)).toHaveLength(40);
  });

  test('a spring starts at 0 and ends at 1 without a visible jump', () => {
    const samples = sampleAnimation(SPRING, 200);

    expect([samples[0], samples[samples.length - 1]]).toEqual([0, 1]);
    expect(Math.abs(1 - samples[samples.length - 2])).toBeLessThan(0.01);
    expect(animationDuration(SPRING)).toBeGreaterThan(300);
  });

  test('a bouncy spring overshoots the end', () => {
    expect(Math.max(...sampleAnimation({ ...TIME, bounce: 0.5 }, 100))).toBeGreaterThan(1.05);
  });

  test('an easing follows its cubic-bezier over its duration', () => {
    const linear: Animation = { type: 'easing', duration: 300, bezier: [0, 0, 1, 1], delay: 0 };

    expect(sampleAnimation(linear, 5).map((value) => Number(value.toFixed(3)))).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(animationDuration(linear)).toBe(300);
  });

  test('an easing transition uses its cubic-bezier and delay', () => {
    expect(animationTransition({ ...EASING, delay: 50 }, 'opacity')).toBe(
      'opacity 240ms cubic-bezier(0.17, 0.67, 0.83, 0.67) 50ms'
    );
  });

  test('a spring transition runs for its settle time along a linear() curve that ends at 1', () => {
    const easing = animationEasing(SPRING);

    expect(easing).toMatch(/^linear\(0, [\d., ]+, 1\)$/);
    expect(animationTransition(SPRING)).toBe(`all ${Math.round(animationDuration(SPRING))}ms ${easing} 0ms`);
  });
});

describe('convertAnimation', () => {
  test('a time animation becomes the spring Motion plays for that duration and bounce, and back', () => {
    const spring = convertAnimation(TIME, 'spring');

    expect(spring).toEqual({
      type: 'spring',
      stiffness: expect.closeTo(685.39, 1),
      damping: expect.closeTo(44.51, 1),
      mass: 1,
      delay: 0,
    });
    expect(convertAnimation(spring, 'time')).toEqual({ ...TIME, bounce: expect.closeTo(0.15, 2) });
  });

  test('an easing keeps the duration and delay of the animation it came from', () => {
    expect(convertAnimation({ ...TIME, delay: 30 }, 'easing')).toEqual({
      type: 'easing',
      duration: 200,
      bezier: [0.25, 0.1, 0.25, 1],
      delay: 30,
    });
  });

  test('converting to the same type returns the animation', () => {
    expect(convertAnimation(SPRING, 'spring')).toBe(SPRING);
  });
});
