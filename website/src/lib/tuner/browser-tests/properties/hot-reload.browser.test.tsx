import { beforeEach, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import {
  clearPropertyTuning,
  hotReloadStylesheet,
  renderProperty,
  serveLinkedStylesheet,
} from '../support/property-harness';
import tokens from './hot-reload/tokens.css?raw';
import { useTunables } from '@/lib/tuner/react';

beforeEach(clearPropertyTuning);

test('an override keeps applying after its stylesheet hot-reloads', async () => {
  const link = await serveLinkedStylesheet(tokens);
  await renderSession();
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');
  await accent.act(() => accent.result.current.onValueChange('#ff0000'));
  const frames = sampleFrames(() => rootValue('--accent'));

  await hotReloadStylesheet(link, tokens.replace('--gap: 8px', '--gap: 10px'));

  await expect.poll(() => [rootValue('--accent'), rootValue('--gap')]).toEqual(['#ff0000', '10px']);
  expect(await frames.stop()).toEqual(['#ff0000']);
});

test('the list of declarations follows stylesheets as they hot-reload', async () => {
  const link = await serveLinkedStylesheet(tokens);
  await renderSession();
  const tunables = await renderHook(() => useTunables());
  const propertyIds = () =>
    tunables.result.current.flatMap((entry) => (entry.kind === 'property' ? [`${entry.id} ${entry.presence}`] : []));
  await expect.poll(propertyIds).toEqual(['--accent|:root applied', '--gap|:root applied']);

  await hotReloadStylesheet(link, `${tokens.replace('--gap: 8px;', '')}\n.widget { --widget-gap: 2px; }`);

  await expect
    .poll(propertyIds)
    .toEqual(['--accent|:root applied', '--gap|:root absent', '--widget-gap|.widget inactive']);
});

function sampleFrames(sample: () => string): { stop(): Promise<readonly string[]> } {
  const seen = new Set<string>();
  let sampling = true;
  const next = () => {
    seen.add(sample());
    if (sampling) requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
  return {
    stop: async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      sampling = false;
      return [...seen];
    },
  };
}

function rootValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
