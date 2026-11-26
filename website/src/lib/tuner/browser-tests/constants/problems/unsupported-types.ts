import { Spacing } from './spacing';
import { tunable } from '@/lib/tuner/tunable';

class Insets {
  top = 0;
}

export const ON_CLOSE = tunable<(reason: string) => void>('unsupported.function', () => {});
export const MAYBE = tunable<number | undefined>('unsupported.undefined', 3);
export const PADDING = tunable<{ top?: number }>('unsupported.optional-field', { top: 1 });
export const RANGE = tunable<[number, number?]>('unsupported.optional-element', [1]);
export const STOPS = tunable<[number, ...string[]]>('unsupported.rest-element', [1]);
export const BIG = tunable<bigint>('unsupported.bigint', BigInt(1));
export const KEY = tunable<symbol>('unsupported.symbol', Symbol('key'));
export const INSETS = tunable<Insets>('unsupported.class', new Insets());
export const SPACING = tunable<Spacing>('unsupported.imported-class', new Spacing());
export const ANYTHING = tunable<unknown>('unsupported.unknown', 1);
