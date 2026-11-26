import { beforeEach, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { clearPropertyTuning, serveStylesheet } from '../support/property-harness';
import values from './types/values.css?raw';
import { useTunables } from '@/lib/tuner/react';

beforeEach(clearPropertyTuning);

test('a declaration takes its type from its registered syntax, else its raw value, else its resolution, else text', async () => {
  serveStylesheet(values);
  await renderSession();

  const tunables = await renderHook(() => useTunables());

  await expect
    .poll(() =>
      tunables.result.current.flatMap((entry) => (entry.kind === 'property' ? [[entry.name, entry.type]] : []))
    )
    .toEqual([
      ['--glow', 'color'],
      ['--stack', 'text'],
      ['--gap', 'length'],
      ['--ratio', 'number'],
      ['--columns', 'integer'],
      ['--spin', 'angle'],
      ['--fade', 'time'],
      ['--half', 'percentage'],
      ['--inset', 'length-percentage'],
      ['--font', 'text'],
      ['--accent', 'color'],
      ['--link', 'color'],
      ['--ring', 'length'],
      ['--hidden-accent', 'color'],
      ['--hidden-link', 'text'],
    ]);
});
