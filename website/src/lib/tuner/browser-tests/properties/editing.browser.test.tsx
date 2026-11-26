import { beforeEach, expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { renderHook } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { clearPropertyTuning, renderProperty, serveStylesheet } from '../support/property-harness';
import tokens from './editing/tokens.css?raw';
import { CSS_COLOR } from '@/lib/tuner/ui';
import { useProperty } from '@/lib/tuner/react';

beforeEach(clearPropertyTuning);

test('setting a declaration updates every element that uses it, and reset restores the stylesheet as written', async () => {
  const style = serveStylesheet(tokens);
  const servedText = sheetText(style);
  await renderSession();
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('applied');

  let accepted: boolean | undefined;
  await accent.act(() => {
    accepted = accent.result.current.onValueChange('#ff0000');
  });
  const whileSet = [rootValue('--accent'), accent.result.current.value, accent.result.current.changed];
  await accent.act(() => accent.result.current.onReset());

  expect([accepted, ...whileSet]).toEqual([true, '#ff0000', '#ff0000', true]);
  expect([rootValue('--accent'), accent.result.current.changed, sheetText(style)]).toEqual([
    '#0d99ff',
    false,
    servedText,
  ]);
});

test('an override applies exactly where its declaration did, so a more specific rule and a matching media query still win', async () => {
  serveStylesheet(tokens);
  const competing = appendElement('competing');
  await page.viewport(800, 600);
  await renderSession();
  const gap = await renderProperty('--gap');
  await expect.poll(() => gap.result.current.entry?.presence).toBe('inactive');

  await gap.act(() => gap.result.current.onValueChange('50px'));
  const wide = [rootValue('--gap'), valueOn(competing, '--gap')];
  await page.viewport(600, 600);

  expect([...wide, rootValue('--gap'), valueOn(competing, '--gap')]).toEqual(['16px', '99px', '50px', '99px']);
});

test('an override keeps the priority of the declaration it replaces', async () => {
  serveStylesheet(tokens);
  serveStylesheet('div.important-host.important-host { --pinned: 9px; }');
  const host = appendElement('important-host');
  await renderSession();
  const pinned = await renderProperty('--pinned', '.important-host');
  await expect.poll(() => pinned.result.current.entry?.presence).toBe('applied');

  await pinned.act(() => pinned.result.current.onValueChange('5px'));

  expect(valueOn(host, '--pinned')).toBe('5px');
});

test.each([
  ['--gap', ':root', '20px', true],
  ['--gap', ':root', 'calc(2px + 1rem)', true],
  ['--gap', ':root', 'red', false],
  ['--accent', ':root', 'rgb(0 0 0 / 0.5)', true],
  ['--accent', ':root', '12px', false],
  ['--muted', ':root', 'var(--accent)', true],
  ['--muted', ':root', 'color-mix(in oklab, var(--accent) 50%, white)', false],
  ['--font', ':root', '"Comic Sans MS", cursive', true],
  ['--font', ':root', 'a; b', false],
  ['--library-size', '.library', '8px', false],
])('setting %s in %s to %s is accepted: %s', async (name, context, value, accepted) => {
  serveStylesheet(tokens);
  serveStylesheet('.library { --library-size: 4px; }');
  await renderSession();
  const property = await renderProperty(name, context);
  await expect.poll(() => property.result.current.entry).not.toBeNull();
  const before = property.result.current.value;
  let result: boolean | undefined;

  await property.act(() => {
    result = property.result.current.onValueChange(value);
  });

  expect([result, property.result.current.value]).toEqual([accepted, accepted ? value : before]);
});

test('pointing a declaration at another property sets it to a reference that resolves through the target', async () => {
  serveStylesheet(tokens);
  await renderSession();
  const muted = await renderProperty('--muted');
  await expect.poll(() => muted.result.current.entry?.presence).toBe('applied');
  let pointed: boolean | undefined;

  await muted.act(() => {
    pointed = muted.result.current.pointTo('--accent');
  });

  expect([pointed, rootValue('--muted')]).toEqual([true, '#0d99ff']);
  await expect
    .poll(() => muted.result.current.entry)
    .toMatchObject({
      value: 'var(--accent)',
      form: 'reference',
      target: '--accent',
      targetInEffect: '--accent|:root',
      resolved: 'rgb(13, 153, 255)',
    });
});

test.each([
  ['--muted', '--nothing', 'a property that is declared nowhere', false],
  ['--muted', '--gap', 'a property of another type', false],
  ['--accent', '--link', 'a property that refers back to it', false],
  ['--accent', '--accent', 'itself', false],
  ['--font', '--gap', 'anything, being text,', true],
])('pointing %s at %s, %s, is accepted: %s', async (name, target, _, accepted) => {
  serveStylesheet(tokens);
  await renderSession();
  const property = await renderProperty(name);
  await expect.poll(() => property.result.current.entry?.presence).toBe('applied');
  const before = property.result.current.value;
  let result: boolean | undefined;

  await property.act(() => {
    result = property.result.current.pointTo(target);
  });

  expect([result, property.result.current.value]).toEqual([accepted, accepted ? `var(${target})` : before]);
});

test('a declaration lists the properties it can point at: of a fitting type and not referring back to it', async () => {
  serveStylesheet(tokens);
  await renderSession();
  const muted = await renderProperty('--muted');
  const accent = await renderProperty('--accent');

  await expect
    .poll(() => [muted.result.current.targets, accent.result.current.targets])
    .toEqual([['--accent', '--link'], ['--muted']]);
});

test.each([
  ['--link', 'a reference, to the raw value of its target in effect', '#0d99ff'],
  ['--radius', 'an expression, to its resolution', '6px'],
])('detaching %s sets %s', async (name, _, detached) => {
  serveStylesheet(tokens);
  await page.viewport(600, 600);
  await renderSession();
  const property = await renderProperty(name);
  await expect.poll(() => property.result.current.entry?.presence).toBe('applied');
  let result: boolean | undefined;

  await property.act(() => {
    result = property.result.current.detach();
  });

  expect([result, property.result.current.value, property.result.current.entry?.form]).toEqual([true, detached, 'raw']);
});

test.each([
  ['--accent', 'a raw value', '600'],
  ['--radius', 'a declaration that applies nowhere right now', '800'],
])('detaching %s, %s, is rejected', async (name, _, width) => {
  serveStylesheet(tokens);
  serveStylesheet('@media (min-width: 640px) { :root { --radius: 2px; } }');
  await page.viewport(Number(width), 600);
  await renderSession();
  const property = await renderProperty(name);
  await expect.poll(() => property.result.current.entry).not.toBeNull();
  const before = property.result.current.value;
  let result: boolean | undefined;

  await property.act(() => {
    result = property.result.current.detach();
  });

  expect([result, property.result.current.value]).toEqual([false, before]);
});

test('a declaration that is not on the page can still be set, pointed and reset', async () => {
  await renderSession();
  const accent = await renderProperty('--accent');
  await expect.poll(() => accent.result.current.entry?.presence).toBe('absent');
  const results: unknown[] = [];

  await accent.act(() => {
    results.push(accent.result.current.onValueChange('#ff0000'));
  });
  results.push(accent.result.current.value);
  await accent.act(() => {
    results.push(accent.result.current.pointTo('--muted'));
  });
  results.push(accent.result.current.value);
  await accent.act(() => accent.result.current.onReset());

  expect([...results, accent.result.current.changed]).toEqual([true, '#ff0000', true, 'var(--muted)', false]);
});

test('a color control shows the readable default while the value is a reference that resolves to nothing', async () => {
  await renderSession();
  const accent = await renderHook(() => useProperty('--accent', { codec: CSS_COLOR }));
  await expect.poll(() => accent.result.current.entry?.presence).toBe('absent');

  await accent.act(() => {
    accent.result.current.pointTo('--muted');
  });

  const { entry, value, defaultValue } = accent.result.current;
  expect([entry?.value, value, defaultValue]).toEqual(['var(--muted)', '#0d99ff', '#0d99ff']);
});

test('a color control whose default is a reference uses the color it resolves to as the default too', async () => {
  serveStylesheet(tokens);
  await renderSession();
  const link = await renderHook(() => useProperty('--link', { codec: CSS_COLOR }));
  await expect.poll(() => link.result.current.entry?.presence).toBe('applied');

  const { entry, value, defaultValue } = link.result.current;
  expect([entry?.defaultValue, value, defaultValue]).toEqual([
    'var(--accent)',
    'rgb(13, 153, 255)',
    'rgb(13, 153, 255)',
  ]);
});

function appendElement(className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

function valueOn(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function rootValue(name: string): string {
  return valueOn(document.documentElement, name);
}

function sheetText(style: HTMLStyleElement): string {
  return [...(style.sheet?.cssRules ?? [])].map((rule) => rule.cssText).join('\n');
}
