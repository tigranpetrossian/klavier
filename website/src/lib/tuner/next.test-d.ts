import type { NextConfig } from 'next';
import { describe, expectTypeOf, test } from 'vitest';
import { withTuner, type TunerOptions } from './next';

describe('withTuner', () => {
  test('wraps a config and options in a phase function', () => {
    expectTypeOf(withTuner).toEqualTypeOf<
      (config: NextConfig, options?: TunerOptions) => (phase: string) => NextConfig
    >();
  });

  test('takes an optional source directory and excluded directories', () => {
    expectTypeOf<TunerOptions>().toEqualTypeOf<{ sourceDirectory?: string; exclude?: readonly string[] }>();
  });

  test('a next.config exports the wrapped config', () => {
    const config = withTuner({ reactStrictMode: true }, { exclude: ['src/app/tuner-lab/_panel'] });
    expectTypeOf(config('phase-development-server')).toEqualTypeOf<NextConfig>();
  });

  test('rejects unknown options', () => {
    // @ts-expect-error: the option is called sourceDirectory
    withTuner({}, { sourceDir: 'app' });
  });
});
