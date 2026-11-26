import { useLayoutEffect, useRef } from 'react';
import { beforeEach, expect, onTestFinished, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { addRootClass, renderProperty, serveStylesheet, settle } from '../support/property-harness';
import { count, countOf, resetCounts } from '../support/untransformed';
import idlePage from './served/idle-page.css?raw';
import { useTunables } from '@/lib/tuner/react';

const IDLE_MS = 600;
const PAGE_ELEMENTS = 5000;
const RESPONSIVE_GAP_MS = 100;
const RENDER = 'property list render';
const ROOT_TOKENS = 60;

beforeEach(resetCounts);

test('a property list that rewrites the page on every render stops rendering while the page is idle', async () => {
  serveStylesheet(idlePage);
  await renderSession();
  await render(<PropertyList />);
  await expect.poll(() => presenceOf('--surface|:root')).toBe('applied');
  await settle();
  const rendersBefore = countOf(RENDER);

  await wait(IDLE_MS);

  expect(countOf(RENDER) - rendersBefore).toBe(0);
});

test('a class toggle still reaches that property list once it is idle', async () => {
  serveStylesheet(idlePage);
  await renderSession();
  await render(<PropertyList />);
  await expect.poll(() => presenceOf('--surface|:root')).toBe('applied');
  await settle();

  addRootClass('dark');

  await expect
    .poll(() => [presenceOf('--surface|:root'), presenceOf('--surface|.dark')])
    .toEqual(['inactive', 'applied']);
});

test('re-reading presence on a page with thousands of elements keeps the main thread responsive', async () => {
  serveStylesheet(idlePage);
  appendElements(PAGE_ELEMENTS);
  await renderSession();
  const darkSurface = await renderProperty('--surface', '.dark');
  await expect.poll(() => darkSurface.result.current.entry?.presence).toBe('inactive');
  await settle();
  const mainThread = watchMainThread();

  addRootClass('dark');
  await expect.poll(() => darkSurface.result.current.entry?.presence).toBe('applied');
  await settle();

  expect(mainThread.stop()).toBeLessThan(RESPONSIVE_GAP_MS);
});

test('re-reading presence with many root tokens on a page with thousands of elements keeps the main thread responsive', async () => {
  serveStylesheet(idlePage);
  serveStylesheet(rootTokens(ROOT_TOKENS));
  appendElements(PAGE_ELEMENTS);
  await renderSession();
  const lastGap = await renderProperty(`--gap-${ROOT_TOKENS - 1}`);
  const darkSurface = await renderProperty('--surface', '.dark');
  await expect
    .poll(() => [lastGap.result.current.entry?.resolved, darkSurface.result.current.entry?.presence])
    .toEqual([`${ROOT_TOKENS * 16}px`, 'inactive']);
  await settle();
  const mainThread = watchMainThread();

  addRootClass('dark');
  await expect.poll(() => darkSurface.result.current.entry?.presence).toBe('applied');
  await settle();

  expect(mainThread.stop()).toBeLessThan(RESPONSIVE_GAP_MS);
});

test('resolving declarations leaves the inline styles of the elements they apply to as they were', async () => {
  serveStylesheet(idlePage);
  const card = appendElement('card');
  const badge = appendElement('badge');
  badge.setAttribute('style', 'color: rgb(255, 0, 0)');
  const badgeStyle = badge.style.cssText;
  await renderSession();

  const cardGap = await renderProperty('--card-gap', '.card');
  const badgePad = await renderProperty('--badge-pad', '.badge');

  await expect
    .poll(() => [cardGap.result.current.entry?.resolved, badgePad.result.current.entry?.resolved])
    .toEqual(['20px', '12px']);
  expect([card.hasAttribute('style'), badge.style.cssText]).toEqual([false, badgeStyle]);
});

function PropertyList() {
  const entries = useTunables();
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    count(RENDER);
    list.current?.setAttribute('data-renders', String(countOf(RENDER)));
  });
  return (
    <ul ref={list}>
      {entries.flatMap((entry) =>
        entry.kind === 'property'
          ? [
              <li key={entry.id} data-id={entry.id} data-presence={entry.presence}>
                <input aria-label={entry.id} value={entry.value} readOnly />
              </li>,
            ]
          : []
      )}
    </ul>
  );
}

function presenceOf(id: string): string | null {
  for (const row of document.querySelectorAll('li[data-id]')) {
    if (row.getAttribute('data-id') === id) return row.getAttribute('data-presence');
  }
  return null;
}

function rootTokens(total: number): string {
  const tokens = Array.from(
    { length: total },
    (_, index) => `--space-${index}: ${index + 1}rem; --gap-${index}: var(--space-${index});`
  );
  return `:root { ${tokens.join(' ')} }`;
}

function appendElement(className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

function appendElements(total: number): void {
  const host = document.createElement('section');
  host.append(...Array.from({ length: total }, () => document.createElement('div')));
  document.body.append(host);
  onTestFinished(() => host.remove());
}

function watchMainThread(): { stop(): number } {
  let longestGap = 0;
  let last = performance.now();
  let timer = setTimeout(tick);
  function tick() {
    const now = performance.now();
    longestGap = Math.max(longestGap, now - last);
    last = now;
    timer = setTimeout(tick);
  }
  return {
    stop: () => {
      clearTimeout(timer);
      return longestGap;
    },
  };
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
