import { clonePlain, isPlainObject } from './plain-data';
import type { TuningStorage } from './value-types';

const OVERRIDES_KEY = 'tuner:overrides';
const HISTORY_KEY = 'tuner:history';

export function createBrowserStorage(): TuningStorage {
  return {
    readOverrides: () => ignoringFailures(() => readOverrideRecord(readJson(localStorage, OVERRIDES_KEY)), {}),
    writeOverrides: (overrides) =>
      ignoringFailures(() => localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides)), undefined),
    readHistory: () => ignoringFailures(() => readJson(sessionStorage, HISTORY_KEY), null),
    writeHistory: (steps) =>
      ignoringFailures(() => sessionStorage.setItem(HISTORY_KEY, JSON.stringify(steps)), undefined),
  };
}

export function createMemoryStorage(): TuningStorage {
  let overrides: Record<string, unknown> = {};
  let history: unknown = null;
  return {
    readOverrides: () => clonePlain(overrides),
    writeOverrides: (next) => {
      overrides = clonePlain(next);
    },
    readHistory: () => clonePlain(history),
    writeHistory: (steps) => {
      history = clonePlain(steps);
    },
  };
}

export function guardStorage(storage: TuningStorage): TuningStorage {
  return {
    readOverrides: () => ignoringFailures(() => readOverrideRecord(storage.readOverrides()), {}),
    writeOverrides: (overrides) => ignoringFailures(() => storage.writeOverrides(overrides), undefined),
    readHistory: () => ignoringFailures(() => storage.readHistory(), null),
    writeHistory: (steps) => ignoringFailures(() => storage.writeHistory(steps), undefined),
  };
}

function readJson(storage: Storage, key: string): unknown {
  const text = storage.getItem(key);
  return text === null ? null : JSON.parse(text);
}

function readOverrideRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function ignoringFailures<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}
