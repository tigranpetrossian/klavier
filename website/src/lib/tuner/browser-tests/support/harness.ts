import { StrictMode, type ReactNode } from 'react';
import { expect, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { createMemoryStorage, useTunable, useTuningSession, type TuningStorage } from '@/lib/tuner/react';

const BROWSER_TESTS_URL = '/src/lib/tuner/browser-tests';

export const ROOTS = [
  ['a plain root', ({ children }: { children: ReactNode }) => children],
  ['a StrictMode root', StrictMode],
] as const;

export async function renderSession(storage: TuningStorage = createMemoryStorage()) {
  return renderHook(() => useTuningSession({ storage }));
}

export async function renderNumber(id: string) {
  return renderHook(() => useTunable(id, isNumber, Number.NaN));
}

export async function renderString(id: string) {
  return renderHook(() => useTunable(id, isString, ''));
}

export async function clearTuning(): Promise<void> {
  const resetting = await renderSession();
  await resetting.act(() => resetting.result.current.resetAll());
  await resetting.unmount();
  const emptyHistory = createMemoryStorage();
  emptyHistory.writeHistory({ undo: [], redo: [] });
  const clearing = await renderSession(emptyHistory);
  await clearing.unmount();
}

export async function hotReload(fixture: string, edit: string): Promise<void> {
  await import(/* @vite-ignore */ `${BROWSER_TESTS_URL}/${fixture}?edit=${edit}`);
}

export function silenceConsole(level: 'error' | 'warn') {
  return vi.spyOn(console, level).mockImplementation(() => {});
}

export function tunerProblem(id: string, location: string): unknown {
  return expect.stringMatching(new RegExp(`^\\[tuner\\] .*'${escapeRegExp(id)}'.*${escapeRegExp(location)}`));
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isAnything(value: unknown): value is unknown {
  return value !== undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
