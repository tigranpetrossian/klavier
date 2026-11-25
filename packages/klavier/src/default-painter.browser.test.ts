import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { CSSProperties } from 'react';
import { mountCore } from './testing/mount-core';
import { unmountEverything } from './testing/mounted';
import type { KlavierOptions } from './klavier-types';

const DEFAULT_LOOK: KlavierOptions = { range: undefined, painter: undefined };
const SCENES: ReadonlyArray<readonly [name: string, options: KlavierOptions, size: CSSProperties]> = [
  ['88-keys-at-rest', {}, { width: '936px', height: '112px' }],
  [
    'pressed-and-highlighted',
    {
      range: [60, 72],
      pressed: [60, 62, 63, 67, 70],
      highlights: { 64: '#3b82f6', 66: '#ef4444', 67: '#facc15', 71: 'not-a-colour' },
    },
    { width: '480px', height: '200px' },
  ],
  ['keys-of-uneven-width', { range: [48, 72], pressed: [49, 55] }, { width: '437px', height: '96px' }],
  ['range-ending-on-black-keys', { range: [61, 70] }, { width: '300px', height: '120px' }],
];

afterEach(unmountEverything);

test.each(SCENES)('%s', async (name, options, size) => {
  const mounted = await mountCore(
    { ...DEFAULT_LOOK, ...options },
    { style: { position: 'fixed', left: '20px', top: '20px', ...size } }
  );

  const pixelRatio = String(devicePixelRatio).replace('.', '_');
  await expect.element(page.elementLocator(mounted.host)).toMatchScreenshot(`${name}-${pixelRatio}x`);
});
