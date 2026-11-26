import { tunable } from '@/lib/tuner/tunable';

export const STUDIO_WIDTH = tunable('studio.width', 320);
export const STUDIO_GAP = tunable('studio.gap', 16);
export const STUDIO_TONE = tunable<'light' | 'dark'>('studio.tone', 'light');
