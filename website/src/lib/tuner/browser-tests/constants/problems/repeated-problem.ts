import { tunable } from '@/lib/tuner/tunable';

export const VARIANT = tunable('broken.variant', 1);
export const ON_CLOSE = tunable<() => number>('broken.on-close', VARIANT > 0 ? () => 1 : () => 2);
