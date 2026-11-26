import type { Tone } from './tones';
import type { Color } from '@/lib/tuner/tunable';

export interface Badge extends Tone {
  count: number;
}

export type Corner = 'top-left' | 'top-right';

export type Swatch = { name: string; color: Color };
