import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { animationDuration, animationEasing, sampleAnimation, type Animation } from './animation.ts';

const REQUESTED_SAMPLES = 200;
const DENSE_SAMPLES = 20_000;
const VISIBLE_JUMP = 0.01;
const VISIBLE_PEAK_LOSS = 0.03;

const editorSpring = fc
  .tuple(between(1, 1000), between(1, 100), between(0.1, 10))
  .map(([stiffness, damping, mass]): Animation => ({ type: 'spring', stiffness, damping, mass, delay: 0 }));

const editorTime = fc
  .tuple(between(100, 2000), between(0, 1))
  .map(([duration, bounce]): Animation => ({ type: 'time', duration, bounce, delay: 0 }));

const editorAnimation = fc.oneof(editorSpring, editorTime);

describe('springs within the ranges of the editor', () => {
  test('arrive at the end without a visible jump', () => {
    fc.assert(
      fc.property(editorAnimation, (animation) => {
        const samples = sampleAnimation(animation, REQUESTED_SAMPLES);

        expect(samples[0]).toBe(0);
        expect(Math.abs(1 - samples[samples.length - 2])).toBeLessThan(VISIBLE_JUMP);
      })
    );
  });

  test('keep their highest peak however few samples are requested', () => {
    fc.assert(
      fc.property(editorAnimation, (animation) => {
        const peak = Math.max(...sampleAnimation(animation, DENSE_SAMPLES));

        expect(peak - Math.max(...sampleAnimation(animation, REQUESTED_SAMPLES))).toBeLessThan(VISIBLE_PEAK_LOSS);
      })
    );
  });

  test('keep their highest peak in the linear() curve', () => {
    fc.assert(
      fc.property(editorAnimation, (animation) => {
        const peak = Math.max(...sampleAnimation(animation, DENSE_SAMPLES));

        expect(peak - Math.max(...linearPoints(animationEasing(animation)))).toBeLessThan(VISIBLE_PEAK_LOSS);
      })
    );
  });

  test('settle in a finite, positive time', () => {
    fc.assert(
      fc.property(editorAnimation, (animation) => {
        const duration = animationDuration(animation);

        expect(Number.isFinite(duration) && duration > 0).toBe(true);
      })
    );
  });
});

function linearPoints(easing: string): number[] {
  return easing
    .replace(/^linear\(|\)$/g, '')
    .split(', ')
    .map(Number);
}

function between(min: number, max: number) {
  return fc.double({ min, max, noNaN: true });
}
