import { expect, onTestFinished } from 'vitest';
import { cdp } from 'vitest/browser';
import { renderHook } from 'vitest-browser-react';
import { clearTuning, renderSession } from './harness';
import { useProperty, useTunables } from '@/lib/tuner/react';

const SETTLE_MS = 300;

export async function clearPropertyTuning(): Promise<void> {
  const loading = await renderSession();
  const tunables = await renderHook(() => useTunables());
  await expect.poll(() => tunables.result.current.some((entry) => entry.kind === 'property')).toBe(true);
  await loading.act(() => loading.result.current.resetAll());
  await tunables.unmount();
  await loading.unmount();
  await clearTuning();
}

export function serveStylesheet(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  onTestFinished(() => style.remove());
  return style;
}

export function addRootClass(name: string): () => void {
  const remove = () => document.documentElement.classList.remove(name);
  document.documentElement.classList.add(name);
  onTestFinished(remove);
  return remove;
}

export async function serveLinkedStylesheet(css: string): Promise<HTMLLinkElement> {
  const link = await linkStylesheet(css);
  onTestFinished(() => link.remove());
  return link;
}

export async function hotReloadStylesheet(current: HTMLLinkElement, css: string): Promise<HTMLLinkElement> {
  const next = await linkStylesheet(css, () => current.remove());
  onTestFinished(() => next.remove());
  return next;
}

export async function renderProperty(name: string, context?: string) {
  return renderHook(() => useProperty(name, { context }));
}

export async function emulateColorScheme(scheme: 'light' | 'dark'): Promise<void> {
  onTestFinished(async () => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  });
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
}

export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

async function linkStylesheet(css: string, onLoad: () => void = () => {}): Promise<HTMLLinkElement> {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
  const loaded = new Promise<void>((resolve) => {
    link.addEventListener('load', () => {
      onLoad();
      resolve();
    });
  });
  document.head.append(link);
  await loaded;
  return link;
}
