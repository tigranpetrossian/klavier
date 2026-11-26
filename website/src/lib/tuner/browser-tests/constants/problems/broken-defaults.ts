import { tunable, type Color } from '@/lib/tuner/tunable';

export const BROKEN_ACCENT = tunable<Color>('broken.accent', '#zzz');
export const EMPTY_STEPS = tunable('broken.empty-steps', []);
export const RATIO = tunable('broken.ratio', Number.NaN);
