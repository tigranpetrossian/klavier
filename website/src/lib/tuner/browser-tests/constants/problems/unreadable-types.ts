import type { Key } from 'react';
import { tunable } from '@/lib/tuner/tunable';

type Pair<T> = [T, T];

interface Boxed<T> {
  value: T;
}

interface Theme {
  tone: 'info' | 'warn';
  gap: number;
}

export const BASE_GAP = { gap: 4 };

export const PAIR = tunable<Pair<number>>('unreadable.generic-alias', [1, 2]);
export const BOXED = tunable<Boxed<number>>('unreadable.generic-interface', { value: 1 });
export const TOP = tunable<Extract<'top' | 'bottom', 'top'>>('unreadable.extract', 'top');
export const GAP = tunable<typeof BASE_GAP>('unreadable.typeof', { gap: 4 });
export const TONE = tunable<Theme['tone']>('unreadable.indexed-access', 'info');
export const THEME_KEY = tunable<keyof Theme>('unreadable.keyof', 'tone');
export const SPACING = tunable<{ [K in 'x' | 'y']: number }>('unreadable.mapped', { x: 1, y: 2 });
export const LIMIT = tunable<'a' extends string ? number : string>('unreadable.conditional', 3);
export const KEY = tunable<Key>('unreadable.package-type', 'row');
export const NAME = tunable<PropertyKey>('unreadable.global-type', 'name');
