import { tunable } from '@/lib/tuner/tunable';

export const GRADIENT_STOPS = tunable<number[]>('saved.stops', [0, 100]);
export const EMPTY_SLOTS = tunable<number[]>('saved.slots', new Array<number>(2));
